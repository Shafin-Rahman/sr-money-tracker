import { API_BASE } from './config.js';
import {
  getRecord, getTable, putRecord, deleteRecord, cacheRows, enqueue, pickColumns,
  getAllRecords, clearAllRecords, TABLE_COLUMNS,
} from './localdb.js';
import { sync, isOnline } from './sync.js';
import { today } from './utils.js';
import {
  getTransactions as localTransactions,
  getTransaction as localTransaction,
  getDashboardSummary as localDashboardSummary,
  getMonthlyStats as localMonthlyStats,
  getReports as localReports,
  search as localSearch,
  getAccountBalance as localAccountBalance,
  recomputeBalances,
  budgetWindow,
  exportJSON as localExportJSON,
  exportTransactionsCSV as localExportCSV,
  exportAccountsCSV as localExportAccountsCSV,
} from './offlineCompute.js';

async function request(endpoint, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function uuid() {
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isNetErr(err) {
  return err && (
    err.message.includes('Cannot connect to server')
    || err.message.includes('Failed to fetch')
    || err.message.includes('NetworkError')
    || err.message.includes('fetch failed')
    || err.message.includes('Load failed')
  );
}

function notFound(name) {
  const err = new Error(`${name} not found`);
  err.status = 404;
  return err;
}

async function serverFirst(serverFn, localFn) {
  if (isOnline()) {
    try {
      return await serverFn();
    } catch (err) {
      if (isNetErr(err)) return localFn();
      throw err;
    }
  }
  return localFn();
}

async function commitWrite(ops) {
  for (const op of ops) {
    await enqueue({ table: op.table, id: op.id, op: op.op, data: op.data });
  }
  try {
    await sync();
  } catch (err) {
    // The local (IndexedDB) write already succeeded. Sync runs in the
    // background and will be retried on next online/visibility event.
    console.warn('Background sync failed, will retry later:', err && err.message);
  }
}

// Recompute account balances and append the changed accounts to `ops`.
// If an account is already in `ops` (e.g. the account being edited), replace
// its data with the freshly recomputed one so the recomputed balance wins and
// the outbox never receives a duplicate entry for the same record id.
async function pushChangedAccounts(ops) {
  const changed = await recomputeBalances();
  const accountIdx = new Map();
  ops.forEach((o, i) => {
    if (o.table === 'accounts') accountIdx.set(o.id, i);
  });
  for (const acc of changed) {
    const data = pickColumns(acc, 'accounts');
    const existingIdx = accountIdx.get(acc.id);
    if (existingIdx !== undefined) {
      ops[existingIdx].data = data;
    } else {
      ops.push({ table: 'accounts', id: acc.id, op: 'upsert', data });
    }
  }
}

async function maxSort(table) {
  const rows = await getTable(table);
  return rows.reduce((m, r) => Math.max(m, r.sort_order || 0), 0) + 1;
}

function buildCategoryTree(categories) {
  const map = {};
  const roots = [];
  categories.forEach((cat) => { map[cat.id] = { ...cat, children: [] }; });
  categories.forEach((cat) => {
    if (cat.parent_id && map[cat.parent_id]) {
      map[cat.parent_id].children.push(map[cat.id]);
    } else if (!cat.parent_id) {
      roots.push(map[cat.id]);
    }
  });
  return roots;
}

async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function pinHashValue(pin) {
  return sha256Hex(pin + 'sr-money-tracker-salt');
}

function calculateNextDate(interval, dayOfMonth, dayOfWeek, startDate) {
  const now = new Date();
  const start = startDate ? new Date(startDate) : now;

  if (interval === 'daily') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  if (interval === 'weekly') {
    const d = new Date(now);
    const targetDay = dayOfWeek || 0;
    const diff = targetDay - d.getDay();
    d.setDate(d.getDate() + (diff > 0 ? diff : diff + 7));
    return d.toISOString().split('T')[0];
  }
  if (interval === 'monthly') {
    const d = new Date(now);
    const day = dayOfMonth || 1;
    d.setDate(day);
    if (d < now) d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  }
  if (interval === 'yearly') {
    const d = new Date(start);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  }
  return start.toISOString().split('T')[0];
}

// Map camelCase backup keys (older local exports) to real table names.
const SNAPSHOT_KEY_MAP = {
  transactionTags: 'transaction_tags',
  loanPayments: 'loan_payments',
  savingsGoals: 'savings_goals',
  recurringBills: 'recurring_bills',
  customFields: 'custom_fields',
  transactionCustomFields: 'transaction_custom_fields',
  txnCustomFields: 'transaction_custom_fields',
};

// Normalize an imported backup into per-table rows, filling missing ids and
// timestamps so the server can insert them.
function normalizeSnapshot(data, ts) {
  const source = {};
  for (const key of Object.keys(data || {})) {
    const table = SNAPSHOT_KEY_MAP[key] || key;
    source[table] = data[key];
  }
  const snapshot = {};
  for (const table of Object.keys(TABLE_COLUMNS)) {
    const rows = Array.isArray(source[table]) ? source[table] : [];
    snapshot[table] = rows.map((r) => {
      const out = pickColumns(r, table);
      if (out.id === undefined || out.id === null) out.id = uuid();
      if (TABLE_COLUMNS[table].includes('created_at') && !out.created_at) out.created_at = ts;
      if (TABLE_COLUMNS[table].includes('updated_at') && !out.updated_at) out.updated_at = ts;
      return out;
    });
  }
  return snapshot;
}

export const api = {
  // Dashboard
  getDashboardSummary() {
    return serverFirst(() => request('/dashboard/summary'), localDashboardSummary);
  },
  getMonthlyStats(year) {
    return serverFirst(
      () => request(`/dashboard/monthly?year=${year || new Date().getFullYear()}`),
      () => localMonthlyStats(year)
    );
  },

  // Accounts
  async getAccounts(params = {}) {
    const local = async () => {
      const list = await getTable('accounts');
      let rows = params.include_archived === 'true' ? list : list.filter((a) => a.is_archived === 0);
      rows = [...rows].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
      return rows;
    };
    const query = new URLSearchParams(params).toString();
    return serverFirst(async () => {
      const result = await request(`/accounts${query ? '?' + query : ''}`);
      await cacheRows('accounts', result);
      return result;
    }, local);
  },
  getAccount(id) {
    return serverFirst(
      () => request(`/accounts/${id}`),
      async () => {
        const row = await getRecord('accounts', id);
        if (!row) throw notFound('Account');
        return row;
      }
    );
  },
  async createAccount(data) {
    const id = uuid();
    const ts = new Date().toISOString();
    const openingBalance = Number(data.openingBalance) || 0;
    const row = pickColumns({
      id,
      name: data.name,
      type: data.type || 'custom',
      icon: data.icon || 'wallet',
      color: data.color || '#6366f1',
      opening_balance: openingBalance,
      current_balance: openingBalance,
      notes: data.notes || null,
      is_active: 1,
      is_archived: 0,
      sort_order: await maxSort('accounts'),
      created_at: ts,
      updated_at: ts,
    }, 'accounts');
    await putRecord('accounts', row);
    await commitWrite([{ table: 'accounts', id, op: 'upsert', data: row }]);
    return row;
  },
  async updateAccount(id, data) {
    const existing = await getRecord('accounts', id);
    if (!existing) throw notFound('Account');
    const row = { ...existing, updated_at: new Date().toISOString() };
    if (data.name) row.name = data.name;
    if (data.type) row.type = data.type;
    if (data.icon) row.icon = data.icon;
    if (data.color) row.color = data.color;
    if (data.notes !== undefined) row.notes = data.notes;
    if (data.isActive !== undefined) row.is_active = data.isActive ? 1 : 0;
    if (data.isArchived !== undefined) row.is_archived = data.isArchived ? 1 : 0;
    if (data.sortOrder) row.sort_order = data.sortOrder;
    if (data.openingBalance !== undefined && data.openingBalance !== null) row.opening_balance = Number(data.openingBalance);
    await putRecord('accounts', row);
    const ops = [{ table: 'accounts', id, op: 'upsert', data: row }];
    await pushChangedAccounts(ops);
    await commitWrite(ops);
    return row;
  },
  async deleteAccount(id) {
    const existing = await getRecord('accounts', id);
    if (!existing) throw notFound('Account');
    const [txns, loans, goals] = await Promise.all([
      getTable('transactions'),
      getTable('loans'),
      getTable('savings_goals'),
    ]);
    const inUseTxns = txns.filter((t) => (t.account_id === id || t.to_account_id === id) && t.is_removed === 0);
    const inUseLoans = loans.filter((l) => l.account_id === id);
    const inUseGoals = goals.filter((g) => g.account_id === id);
    if (inUseTxns.length > 0 || inUseLoans.length > 0 || inUseGoals.length > 0) {
      const err = new Error('Cannot delete an account that has transactions, loans or savings goals. Archive it instead.');
      err.status = 400;
      throw err;
    }
    await deleteRecord('accounts', id);
    await commitWrite([{ table: 'accounts', id, op: 'delete' }]);
    return { message: 'Account deleted successfully' };
  },
  getAccountBalance() {
    return serverFirst(() => request('/accounts/balance'), localAccountBalance);
  },

  // Categories
  async getCategories(params = {}) {
    const local = async () => {
      let rows = await getTable('categories');
      if (params.type) rows = rows.filter((c) => c.type === params.type);
      if (params.include_archived !== 'true') rows = rows.filter((c) => c.is_archived === 0);
      rows = [...rows].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
      return { categories: rows, tree: buildCategoryTree(rows) };
    };
    const query = new URLSearchParams(params).toString();
    return serverFirst(async () => {
      const result = await request(`/categories${query ? '?' + query : ''}`);
      await cacheRows('categories', result.categories);
      return result;
    }, local);
  },
  getCategory(id) {
    return serverFirst(
      () => request(`/categories/${id}`),
      async () => {
        const row = await getRecord('categories', id);
        if (!row) throw notFound('Category');
        const children = (await getTable('categories')).filter((c) => c.parent_id === id)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        return { ...row, children };
      }
    );
  },
  async createCategory(data) {
    const id = uuid();
    const ts = new Date().toISOString();
    if (data.parentId) {
      const parent = await getRecord('categories', data.parentId);
      if (!parent) {
        const err = new Error('Parent category not found');
        err.status = 404;
        throw err;
      }
    }
    const row = pickColumns({
      id,
      name: data.name,
      type: data.type,
      parent_id: data.parentId || null,
      icon: data.icon || 'circle',
      color: data.color || '#6366f1',
      is_active: 1,
      is_archived: 0,
      sort_order: data.sortOrder || 0,
      created_at: ts,
      updated_at: ts,
    }, 'categories');
    await putRecord('categories', row);
    await commitWrite([{ table: 'categories', id, op: 'upsert', data: row }]);
    return row;
  },
  async updateCategory(id, data) {
    const existing = await getRecord('categories', id);
    if (!existing) throw notFound('Category');
    const row = { ...existing, updated_at: new Date().toISOString() };
    if (data.name) row.name = data.name;
    if (data.type) row.type = data.type;
    if (data.icon) row.icon = data.icon;
    if (data.color) row.color = data.color;
    if (data.parentId !== undefined) row.parent_id = data.parentId;
    if (data.isActive !== undefined) row.is_active = data.isActive ? 1 : 0;
    if (data.isArchived !== undefined) row.is_archived = data.isArchived ? 1 : 0;
    if (data.sortOrder) row.sort_order = data.sortOrder;
    await putRecord('categories', row);
    await commitWrite([{ table: 'categories', id, op: 'upsert', data: row }]);
    return row;
  },
  async deleteCategory(id) {
    const existing = await getRecord('categories', id);
    if (!existing) throw notFound('Category');
    const children = (await getTable('categories')).filter((c) => c.parent_id === id);
    if (children.length > 0) {
      throw new Error('Cannot delete category with subcategories. Remove or reassign them first.');
    }
    const ops = [];
    const txns = await getTable('transactions');
    for (const t of txns.filter((t) => t.category_id === id)) {
      const row = { ...t, category_id: null, updated_at: new Date().toISOString() };
      await putRecord('transactions', row);
      ops.push({ table: 'transactions', id: t.id, op: 'upsert', data: row });
    }
    await deleteRecord('categories', id);
    ops.push({ table: 'categories', id, op: 'delete' });
    await commitWrite(ops);
    return { message: 'Category deleted successfully' };
  },
  async mergeCategories(data) {
    const ts = new Date().toISOString();
    const { sourceId, targetId } = data;
    const source = await getRecord('categories', sourceId);
    const target = await getRecord('categories', targetId);
    if (!source || !target) {
      const err = new Error('Source or target category not found');
      err.status = 404;
      throw err;
    }
    const ops = [];
    const txns = await getTable('transactions');
    for (const t of txns.filter((t) => t.category_id === sourceId)) {
      const row = { ...t, category_id: targetId, updated_at: ts };
      await putRecord('transactions', row);
      ops.push({ table: 'transactions', id: t.id, op: 'upsert', data: row });
    }
    const budgets = await getTable('budgets');
    for (const b of budgets.filter((b) => b.category_id === sourceId)) {
      const row = { ...b, category_id: targetId, updated_at: ts };
      await putRecord('budgets', row);
      ops.push({ table: 'budgets', id: b.id, op: 'upsert', data: row });
    }
    await deleteRecord('categories', sourceId);
    ops.push({ table: 'categories', id: sourceId, op: 'delete' });
    await commitWrite(ops);
    return { message: 'Categories merged successfully', target };
  },

  // Transactions
  getTransactions(params = {}) {
    return serverFirst(() => {
      const query = new URLSearchParams(params).toString();
      return request(`/transactions${query ? '?' + query : ''}`);
    }, () => localTransactions(params));
  },
  getTransaction(id) {
    return serverFirst(() => request(`/transactions/${id}`), () => localTransaction(id));
  },
  async createTransaction(data) {
    const id = uuid();
    const ts = new Date().toISOString();
    if (Number(data.amount) < 0) {
      const err = new Error('Amount cannot be negative');
      err.status = 400;
      throw err;
    }
    if (data.type === 'transfer') {
      if (!data.toAccountId) {
        const err = new Error('Transfer requires a destination account');
        err.status = 400;
        throw err;
      }
      if (data.toAccountId === data.accountId) {
        const err = new Error('Source and destination account must be different');
        err.status = 400;
        throw err;
      }
    }
    if (data.accountId) {
      const account = await getRecord('accounts', data.accountId);
      if (!account) {
        const err = new Error('Account not found');
        err.status = 404;
        throw err;
      }
    }

    const row = pickColumns({
      id,
      type: data.type,
      amount: Number(data.amount),
      account_id: data.accountId,
      to_account_id: data.toAccountId || null,
      category_id: data.categoryId || null,
      description: data.description || null,
      person_name: data.personName || null,
      person_phone: data.personPhone || null,
      location: data.location || null,
      notes: data.notes || null,
      date: data.date,
      time: data.time || null,
      is_recurring: 0,
      is_removed: 0,
      created_at: ts,
      updated_at: ts,
    }, 'transactions');
    await putRecord('transactions', row);

    const ops = [{ table: 'transactions', id, op: 'upsert', data: row }];
    if (Array.isArray(data.tags)) {
      for (const tagId of data.tags) {
        const linkId = uuid();
        const link = { id: linkId, transaction_id: id, tag_id: tagId };
        await putRecord('transaction_tags', link);
        ops.push({ table: 'transaction_tags', id: linkId, op: 'upsert', data: link });
      }
    }
    const changedAccounts = await recomputeBalances();
    for (const acc of changedAccounts) {
      ops.push({ table: 'accounts', id: acc.id, op: 'upsert', data: pickColumns(acc, 'accounts') });
    }
    await commitWrite(ops);
    return localTransaction(id);
  },
  async updateTransaction(id, data) {
    const existing = await getRecord('transactions', id);
    if (!existing) throw notFound('Transaction');
    const ts = new Date().toISOString();
    const row = { ...existing, updated_at: ts };

    if (data.amount !== undefined && data.amount !== null && Number(data.amount) < 0) {
      const err = new Error('Amount cannot be negative');
      err.status = 400;
      throw err;
    }
    if ((data.type || row.type) === 'transfer') {
      const from = data.accountId || row.account_id;
      const to = data.toAccountId !== undefined ? data.toAccountId : row.to_account_id;
      if (!to) {
        const err = new Error('Transfer requires a destination account');
        err.status = 400;
        throw err;
      }
      if (to === from) {
        const err = new Error('Source and destination account must be different');
        err.status = 400;
        throw err;
      }
    }

    if (data.type) row.type = data.type;
    if (data.amount !== undefined && data.amount !== null) row.amount = Number(data.amount);
    if (data.accountId) row.account_id = data.accountId;
    if (data.toAccountId !== undefined) row.to_account_id = data.toAccountId;
    if (data.categoryId !== undefined) row.category_id = data.categoryId;
    if (data.description) row.description = data.description;
    if (data.personName) row.person_name = data.personName;
    if (data.personPhone) row.person_phone = data.personPhone;
    if (data.location) row.location = data.location;
    if (data.notes) row.notes = data.notes;
    if (data.date) row.date = data.date;
    if (data.time) row.time = data.time;
    if (data.isRemoved !== undefined) row.is_removed = data.isRemoved ? 1 : 0;

    await putRecord('transactions', row);

    const ops = [{ table: 'transactions', id, op: 'upsert', data: row }];
    if (data.tags !== undefined) {
      const links = (await getTable('transaction_tags')).filter((l) => l.transaction_id === id);
      for (const l of links) {
        await deleteRecord('transaction_tags', l.id);
        ops.push({ table: 'transaction_tags', id: l.id, op: 'delete' });
      }
      for (const tagId of data.tags) {
        const linkId = uuid();
        const link = { id: linkId, transaction_id: id, tag_id: tagId };
        await putRecord('transaction_tags', link);
        ops.push({ table: 'transaction_tags', id: linkId, op: 'upsert', data: link });
      }
    }
    const changedAccounts = await recomputeBalances();
    for (const acc of changedAccounts) {
      ops.push({ table: 'accounts', id: acc.id, op: 'upsert', data: pickColumns(acc, 'accounts') });
    }
    await commitWrite(ops);
    return localTransaction(id);
  },
  async deleteTransaction(id) {
    const existing = await getRecord('transactions', id);
    if (!existing) throw notFound('Transaction');
    const ts = new Date().toISOString();
    const row = { ...existing, is_removed: 1, updated_at: ts };
    await putRecord('transactions', row);
    const ops = [{ table: 'transactions', id, op: 'upsert', data: row }];
    const changedAccounts = await recomputeBalances();
    for (const acc of changedAccounts) {
      ops.push({ table: 'accounts', id: acc.id, op: 'upsert', data: pickColumns(acc, 'accounts') });
    }
    await commitWrite(ops);
    return { message: 'Transaction removed successfully' };
  },
  async duplicateTransaction(id) {
    const existing = await getRecord('transactions', id);
    if (!existing) throw notFound('Transaction');
    const newId = uuid();
    const ts = new Date().toISOString();
    const row = { ...existing, id: newId, created_at: ts, updated_at: ts };
    delete row.tags;
    await putRecord('transactions', row);
    const ops = [{ table: 'transactions', id: newId, op: 'upsert', data: row }];
    const oldLinks = (await getTable('transaction_tags')).filter((l) => l.transaction_id === id);
    for (const l of oldLinks) {
      const linkId = uuid();
      const link = { id: linkId, transaction_id: newId, tag_id: l.tag_id };
      await putRecord('transaction_tags', link);
      ops.push({ table: 'transaction_tags', id: linkId, op: 'upsert', data: link });
    }
    await pushChangedAccounts(ops);
    await commitWrite(ops);
    return localTransaction(newId);
  },

  // Loans
  async getLoans(params = {}) {
    const local = async () => {
      let loans = await getTable('loans');
      if (params.type) loans = loans.filter((l) => l.type === params.type);
      if (params.status) loans = loans.filter((l) => l.status === params.status);
      loans.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      const payments = await getTable('loan_payments');
      const result = [];
      for (const loan of loans) {
        const lp = payments.filter((p) => p.loan_id === loan.id).sort((a, b) => b.date.localeCompare(a.date));
        const paid = lp.reduce((s, p) => s + p.amount, 0);
        const remaining = (loan.amount || 0) - paid;
        const row = { ...loan, payments: lp, paidAmount: paid, remainingAmount: remaining };
        if (remaining <= 0 && loan.status === 'active') {
          row.status = 'paid';
          row.remaining_amount = 0;
          row.updated_at = new Date().toISOString();
          await putRecord('loans', pickColumns(row, 'loans'));
          await enqueue({ table: 'loans', id: loan.id, op: 'upsert', data: pickColumns(row, 'loans') });
        }
        result.push(row);
      }
      return result;
    };
    const query = new URLSearchParams(params).toString();
    return serverFirst(async () => {
      const result = await request(`/loans${query ? '?' + query : ''}`);
      await cacheRows('loans', result);
      return result;
    }, local);
  },
  getLoan(id) {
    return serverFirst(
      () => request(`/loans/${id}`),
      async () => {
        const row = await getRecord('loans', id);
        if (!row) throw notFound('Loan');
        const payments = (await getTable('loan_payments')).filter((p) => p.loan_id === id)
          .sort((a, b) => b.date.localeCompare(a.date));
        const paid = payments.reduce((s, p) => s + p.amount, 0);
        return { ...row, payments, paidAmount: paid, remainingAmount: (row.amount || 0) - paid };
      }
    );
  },
  async createLoan(data) {
    const id = uuid();
    const ts = new Date().toISOString();
    const amount = Number(data.amount) || 0;
    const row = pickColumns({
      id,
      type: data.type,
      person_name: data.personName,
      person_phone: data.personPhone || null,
      person_address: data.personAddress || null,
      amount,
      paid_amount: 0,
      remaining_amount: amount,
      interest_rate: data.interestRate || 0,
      account_id: data.accountId || null,
      due_date: data.dueDate || null,
      status: 'active',
      notes: data.notes || null,
      created_at: ts,
      updated_at: ts,
    }, 'loans');
    await putRecord('loans', row);
    const ops = [{ table: 'loans', id, op: 'upsert', data: row }];
    await pushChangedAccounts(ops);
    await commitWrite(ops);
    return row;
  },
  async updateLoan(id, data) {
    const existing = await getRecord('loans', id);
    if (!existing) throw notFound('Loan');
    const row = { ...existing, updated_at: new Date().toISOString() };
    if (data.personName) row.person_name = data.personName;
    if (data.personPhone) row.person_phone = data.personPhone;
    if (data.personAddress) row.person_address = data.personAddress;
    if (data.amount) row.amount = Number(data.amount);
    if (data.dueDate) row.due_date = data.dueDate;
    if (data.status) row.status = data.status;
    if (data.notes) row.notes = data.notes;
    const payments = (await getTable('loan_payments')).filter((p) => p.loan_id === id);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    row.paid_amount = totalPaid;
    row.remaining_amount = (row.amount || 0) - totalPaid;
    if (row.remaining_amount <= 0 && row.status === 'active') row.status = 'paid';
    await putRecord('loans', row);
    const ops = [{ table: 'loans', id, op: 'upsert', data: pickColumns(row, 'loans') }];
    await pushChangedAccounts(ops);
    await commitWrite(ops);
    return row;
  },
  async deleteLoan(id) {
    const existing = await getRecord('loans', id);
    if (!existing) throw notFound('Loan');
    const ops = [];
    const payments = (await getTable('loan_payments')).filter((p) => p.loan_id === id);
    for (const p of payments) {
      await deleteRecord('loan_payments', p.id);
      ops.push({ table: 'loan_payments', id: p.id, op: 'delete' });
    }
    await deleteRecord('loans', id);
    ops.push({ table: 'loans', id, op: 'delete' });
    await pushChangedAccounts(ops);
    await commitWrite(ops);
    return { message: 'Loan deleted successfully' };
  },
  async addLoanPayment(id, data) {
    const existing = await getRecord('loans', id);
    if (!existing) throw notFound('Loan');
    const amount = Number(data.amount);
    if (amount <= 0) {
      const err = new Error('Payment amount must be positive');
      err.status = 400;
      throw err;
    }
    const ts = new Date().toISOString();
    const paymentId = uuid();
    const payment = pickColumns({
      id: paymentId,
      loan_id: id,
      amount,
      date: data.date,
      notes: data.notes || null,
      created_at: ts,
    }, 'loan_payments');
    await putRecord('loan_payments', payment);

    const payments = (await getTable('loan_payments')).filter((p) => p.loan_id === id);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const remaining = (existing.amount || 0) - totalPaid;
    const newStatus = remaining <= 0 ? 'paid' : 'active';
    const loan = { ...existing, paid_amount: totalPaid, remaining_amount: remaining, status: newStatus, updated_at: ts };
    await putRecord('loans', loan);

    const ops = [
      { table: 'loan_payments', id: paymentId, op: 'upsert', data: payment },
      { table: 'loans', id, op: 'upsert', data: pickColumns(loan, 'loans') },
    ];
    const changedAccounts = await recomputeBalances();
    for (const acc of changedAccounts) {
      ops.push({ table: 'accounts', id: acc.id, op: 'upsert', data: pickColumns(acc, 'accounts') });
    }
    await commitWrite(ops);
    return payment;
  },

  // Tags
  getTags() {
    return serverFirst(async () => {
      const result = await request('/tags');
      await cacheRows('tags', result);
      return result;
    }, () => getTable('tags'));
  },
  async createTag(data) {
    const id = uuid();
    const ts = new Date().toISOString();
    const row = pickColumns({ id, name: data.name, color: data.color || '#6366f1', created_at: ts }, 'tags');
    await putRecord('tags', row);
    await commitWrite([{ table: 'tags', id, op: 'upsert', data: row }]);
    return row;
  },
  async updateTag(id, data) {
    const existing = await getRecord('tags', id);
    if (!existing) throw notFound('Tag');
    const row = { ...existing };
    if (data.name) row.name = data.name;
    if (data.color) row.color = data.color;
    await putRecord('tags', row);
    await commitWrite([{ table: 'tags', id, op: 'upsert', data: row }]);
    return row;
  },
  async deleteTag(id) {
    const existing = await getRecord('tags', id);
    if (!existing) throw notFound('Tag');
    const ops = [];
    const links = (await getTable('transaction_tags')).filter((l) => l.tag_id === id);
    for (const l of links) {
      await deleteRecord('transaction_tags', l.id);
      ops.push({ table: 'transaction_tags', id: l.id, op: 'delete' });
    }
    await deleteRecord('tags', id);
    ops.push({ table: 'tags', id, op: 'delete' });
    await commitWrite(ops);
    return { message: 'Tag deleted successfully' };
  },

  // Budgets
  async getBudgets(params = {}) {
    const local = async () => {
      let budgets = await getTable('budgets');
      if (params.period) budgets = budgets.filter((b) => b.period === params.period);
      if (params.isActive !== undefined) {
        const want = params.isActive === 'true' ? 1 : 0;
        budgets = budgets.filter((b) => b.is_active === want);
      }
      budgets.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      const categories = await getTable('categories');
      const txns = (await getTable('transactions')).filter((t) => t.is_removed === 0 && t.type === 'expense');
      return budgets.map((b) => {
        const cat = categories.find((c) => c.id === b.category_id);
        const win = budgetWindow(b);
        // Overall budget (no category) counts ALL expense transactions in the window.
        const scope = b.category_id ? txns.filter((t) => t.category_id === b.category_id) : txns;
        const spent = scope
          .filter((t) => t.date >= win.start && t.date <= win.end)
          .reduce((s, t) => s + t.amount, 0);
        return {
          ...b,
          category_name: cat ? cat.name : null,
          category_icon: cat ? cat.icon : null,
          category_color: cat ? cat.color : null,
          spent,
          remaining: (b.amount || 0) - spent,
          percentage: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
        };
      });
    };
    const query = new URLSearchParams(params).toString();
    return serverFirst(async () => {
      const result = await request(`/budgets${query ? '?' + query : ''}`);
      await cacheRows('budgets', result);
      return result;
    }, local);
  },
  async createBudget(data) {
    const id = uuid();
    const ts = new Date().toISOString();
    const row = pickColumns({
      id,
      category_id: data.categoryId || null,
      amount: Number(data.amount),
      period: data.period,
      start_date: data.startDate,
      end_date: data.endDate || null,
      is_active: 1,
      created_at: ts,
      updated_at: ts,
    }, 'budgets');
    await putRecord('budgets', row);
    await commitWrite([{ table: 'budgets', id, op: 'upsert', data: row }]);
    return row;
  },
  async updateBudget(id, data) {
    const existing = await getRecord('budgets', id);
    if (!existing) throw notFound('Budget');
    const row = { ...existing, updated_at: new Date().toISOString() };
    if (data.categoryId) row.category_id = data.categoryId;
    if (data.amount) row.amount = Number(data.amount);
    if (data.period) row.period = data.period;
    if (data.startDate) row.start_date = data.startDate;
    if (data.endDate !== undefined) row.end_date = data.endDate;
    if (data.isActive !== undefined) row.is_active = data.isActive ? 1 : 0;
    await putRecord('budgets', row);
    await commitWrite([{ table: 'budgets', id, op: 'upsert', data: row }]);
    return row;
  },
  async deleteBudget(id) {
    const existing = await getRecord('budgets', id);
    if (!existing) throw notFound('Budget');
    await deleteRecord('budgets', id);
    await commitWrite([{ table: 'budgets', id, op: 'delete' }]);
    return { message: 'Budget deleted successfully' };
  },

  // Reports
  getReports(params = {}) {
    return serverFirst(() => {
      const query = new URLSearchParams(params).toString();
      return request(`/reports${query ? '?' + query : ''}`);
    }, () => localReports(params));
  },

  // Settings
  async getSettings() {
    const local = async () => {
      const rows = await getTable('settings');
      const settings = {};
      rows.forEach((s) => { settings[s.key] = s.value; });
      return settings;
    };
    return serverFirst(() => request('/settings'), local);
  },
  async updateSetting(key, value) {
    const ts = new Date().toISOString();
    const rows = await getTable('settings');
    let existing = rows.find((s) => s.key === key);
    let row;
    if (existing) {
      row = { ...existing, value, updated_at: ts };
    } else {
      row = pickColumns({ id: uuid(), key, value, created_at: ts, updated_at: ts }, 'settings');
    }
    await putRecord('settings', row);
    await commitWrite([{ table: 'settings', id: row.id, op: 'upsert', data: row }]);
    return row;
  },

  // Search
  search(q) {
    return serverFirst(() => request(`/search?q=${encodeURIComponent(q)}`), () => localSearch(q));
  },

  // Savings Goals
  async getSavingsGoals() {
    const local = async () => {
      const goals = (await getTable('savings_goals'))
        .filter((g) => g.is_active === 1)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      return goals.map((g) => ({
        ...g,
        progress: g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0,
        remaining: Math.max(0, g.target_amount - g.current_amount),
      }));
    };
    return serverFirst(async () => {
      const result = await request('/savings');
      await cacheRows('savings_goals', result);
      return result;
    }, local);
  },
  getSavingsGoal(id) {
    return serverFirst(
      () => request(`/savings/${id}`),
      async () => {
        const g = await getRecord('savings_goals', id);
        if (!g) throw notFound('Savings goal');
        return {
          ...g,
          progress: g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0,
          remaining: Math.max(0, g.target_amount - g.current_amount),
        };
      }
    );
  },
  async createSavingsGoal(data) {
    const id = uuid();
    const ts = new Date().toISOString();
    const row = pickColumns({
      id,
      name: data.name,
      target_amount: Number(data.targetAmount),
      current_amount: Number(data.currentAmount) || 0,
      account_id: data.accountId || null,
      deadline: data.deadline || null,
      icon: data.icon || 'piggy-bank',
      color: data.color || '#6366f1',
      notes: data.notes || null,
      is_active: 1,
      created_at: ts,
      updated_at: ts,
    }, 'savings_goals');
    await putRecord('savings_goals', row);
    const ops = [{ table: 'savings_goals', id, op: 'upsert', data: row }];
    await pushChangedAccounts(ops);
    await commitWrite(ops);
    return row;
  },
  async updateSavingsGoal(id, data) {
    const existing = await getRecord('savings_goals', id);
    if (!existing) throw notFound('Savings goal');
    const row = { ...existing, updated_at: new Date().toISOString() };
    if (data.name) row.name = data.name;
    if (data.targetAmount) row.target_amount = Number(data.targetAmount);
    if (data.currentAmount) row.current_amount = Number(data.currentAmount);
    if (data.accountId !== undefined) row.account_id = data.accountId;
    if (data.deadline) row.deadline = data.deadline;
    if (data.icon) row.icon = data.icon;
    if (data.color) row.color = data.color;
    if (data.notes !== undefined) row.notes = data.notes;
    if (data.isActive !== undefined) row.is_active = data.isActive ? 1 : 0;
    await putRecord('savings_goals', row);
    const ops = [{ table: 'savings_goals', id, op: 'upsert', data: pickColumns(row, 'savings_goals') }];
    await pushChangedAccounts(ops);
    await commitWrite(ops);
    return row;
  },
  async deleteSavingsGoal(id) {
    const existing = await getRecord('savings_goals', id);
    if (!existing) throw notFound('Savings goal');
    await deleteRecord('savings_goals', id);
    const ops = [{ table: 'savings_goals', id, op: 'delete' }];
    await pushChangedAccounts(ops);
    await commitWrite(ops);
    return { message: 'Savings goal deleted' };
  },
  async addSavingsFunds(id, data) {
    const existing = await getRecord('savings_goals', id);
    if (!existing) throw notFound('Savings goal');
    const amount = Number(data.amount);
    if (!amount || amount <= 0) {
      const err = new Error('Amount must be positive');
      err.status = 400;
      throw err;
    }
    const ts = new Date().toISOString();
    const newAmount = existing.current_amount + amount;
    const goal = { ...existing, current_amount: newAmount, updated_at: ts };
    await putRecord('savings_goals', goal);
    const ops = [{ table: 'savings_goals', id, op: 'upsert', data: pickColumns(goal, 'savings_goals') }];
    const changedAccounts = await recomputeBalances();
    for (const acc of changedAccounts) {
      ops.push({ table: 'accounts', id: acc.id, op: 'upsert', data: pickColumns(acc, 'accounts') });
    }
    await commitWrite(ops);
    return { message: 'Funds added', currentAmount: newAmount };
  },

  // Recurring Bills
  async getRecurringBills() {
    const local = async () => {
      const bills = await getTable('recurring_bills');
      const categories = await getTable('categories');
      const accounts = await getTable('accounts');
      return bills.map((b) => {
        const c = categories.find((x) => x.id === b.category_id);
        const a = accounts.find((x) => x.id === b.account_id);
        return {
          ...b,
          category_name: c ? c.name : null,
          category_color: c ? c.color : null,
          category_icon: c ? c.icon : null,
          account_name: a ? a.name : null,
          account_color: a ? a.color : null,
        };
      }).sort((x, y) => (x.next_date || '').localeCompare(y.next_date || ''));
    };
    return serverFirst(async () => {
      const result = await request('/recurring');
      await cacheRows('recurring_bills', result);
      return result;
    }, local);
  },
  getRecurringBill(id) {
    return serverFirst(
      () => request(`/recurring/${id}`),
      async () => {
        const row = await getRecord('recurring_bills', id);
        if (!row) throw notFound('Recurring bill');
        const categories = await getTable('categories');
        const accounts = await getTable('accounts');
        const c = categories.find((x) => x.id === row.category_id);
        const a = accounts.find((x) => x.id === row.account_id);
        return { ...row, category_name: c ? c.name : null, account_name: a ? a.name : null };
      }
    );
  },
  async createRecurringBill(data) {
    const id = uuid();
    const ts = new Date().toISOString();
    const row = pickColumns({
      id,
      name: data.name,
      amount: Number(data.amount),
      category_id: data.categoryId || null,
      account_id: data.accountId || null,
      interval: data.interval,
      day_of_month: data.dayOfMonth || null,
      day_of_week: data.dayOfWeek || null,
      start_date: data.startDate,
      end_date: data.endDate || null,
      next_date: calculateNextDate(data.interval, data.dayOfMonth, data.dayOfWeek, data.startDate),
      is_active: 1,
      notes: data.notes || null,
      created_at: ts,
      updated_at: ts,
    }, 'recurring_bills');
    await putRecord('recurring_bills', row);
    await commitWrite([{ table: 'recurring_bills', id, op: 'upsert', data: row }]);
    return row;
  },
  async updateRecurringBill(id, data) {
    const existing = await getRecord('recurring_bills', id);
    if (!existing) throw notFound('Recurring bill');
    const row = { ...existing, updated_at: new Date().toISOString() };
    if (data.name) row.name = data.name;
    if (data.amount) row.amount = Number(data.amount);
    if (data.categoryId !== undefined) row.category_id = data.categoryId;
    if (data.accountId !== undefined) row.account_id = data.accountId;
    if (data.interval) row.interval = data.interval;
    if (data.dayOfMonth !== undefined) row.day_of_month = data.dayOfMonth;
    if (data.dayOfWeek !== undefined) row.day_of_week = data.dayOfWeek;
    if (data.startDate) row.start_date = data.startDate;
    if (data.endDate !== undefined) row.end_date = data.endDate;
    if (data.isActive !== undefined) row.is_active = data.isActive ? 1 : 0;
    if (data.notes !== undefined) row.notes = data.notes;
    if (data.startDate || data.interval) {
      row.next_date = calculateNextDate(data.interval || row.interval, row.day_of_month, row.day_of_week, data.startDate || row.start_date);
    }
    await putRecord('recurring_bills', row);
    await commitWrite([{ table: 'recurring_bills', id, op: 'upsert', data: row }]);
    return row;
  },
  async deleteRecurringBill(id) {
    const existing = await getRecord('recurring_bills', id);
    if (!existing) throw notFound('Recurring bill');
    await deleteRecord('recurring_bills', id);
    await commitWrite([{ table: 'recurring_bills', id, op: 'delete' }]);
    return { message: 'Recurring bill deleted' };
  },

  // Custom Fields
  getCustomFields() {
    return serverFirst(async () => {
      const result = await request('/custom-fields');
      await cacheRows('custom_fields', result);
      return result;
    }, async () => {
      const rows = await getTable('custom_fields');
      return rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
    });
  },
  async createCustomField(data) {
    const id = uuid();
    const ts = new Date().toISOString();
    const row = pickColumns({
      id,
      name: data.name,
      type: data.type || 'text',
      is_required: data.isRequired ? 1 : 0,
      sort_order: await maxSort('custom_fields'),
      created_at: ts,
      updated_at: ts,
    }, 'custom_fields');
    await putRecord('custom_fields', row);
    await commitWrite([{ table: 'custom_fields', id, op: 'upsert', data: row }]);
    return row;
  },
  async updateCustomField(id, data) {
    const existing = await getRecord('custom_fields', id);
    if (!existing) throw notFound('Custom field');
    const row = { ...existing, updated_at: new Date().toISOString() };
    if (data.name) row.name = data.name;
    if (data.type) row.type = data.type;
    if (data.isRequired !== undefined) row.is_required = data.isRequired ? 1 : 0;
    if (data.sortOrder) row.sort_order = data.sortOrder;
    await putRecord('custom_fields', row);
    await commitWrite([{ table: 'custom_fields', id, op: 'upsert', data: row }]);
    return row;
  },
  async deleteCustomField(id) {
    const existing = await getRecord('custom_fields', id);
    if (!existing) throw notFound('Custom field');
    const ops = [];
    const links = (await getTable('transaction_custom_fields')).filter((l) => l.field_id === id);
    for (const l of links) {
      await deleteRecord('transaction_custom_fields', l.id);
      ops.push({ table: 'transaction_custom_fields', id: l.id, op: 'delete' });
    }
    await deleteRecord('custom_fields', id);
    ops.push({ table: 'custom_fields', id, op: 'delete' });
    await commitWrite(ops);
    return { message: 'Custom field deleted' };
  },
  getTransactionCustomFields(transactionId) {
    return serverFirst(
      () => request(`/custom-fields/transactions/${transactionId}`),
      async () => {
        const links = (await getTable('transaction_custom_fields')).filter((l) => l.transaction_id === transactionId);
        const fields = await getTable('custom_fields');
        return links.map((l) => {
          const f = fields.find((x) => x.id === l.field_id);
          return { ...l, field_name: f ? f.name : null, field_type: f ? f.type : null };
        });
      }
    );
  },
  async setTransactionCustomFields(transactionId, data) {
    const ts = new Date().toISOString();
    const ops = [];
    const links = (await getTable('transaction_custom_fields')).filter((l) => l.transaction_id === transactionId);
    for (const l of links) {
      await deleteRecord('transaction_custom_fields', l.id);
      ops.push({ table: 'transaction_custom_fields', id: l.id, op: 'delete' });
    }
    const fields = data.fields || [];
    for (const f of fields) {
      const linkId = uuid();
      const link = pickColumns({ id: linkId, transaction_id: transactionId, field_id: f.fieldId, value: f.value, created_at: ts }, 'transaction_custom_fields');
      await putRecord('transaction_custom_fields', link);
      ops.push({ table: 'transaction_custom_fields', id: linkId, op: 'upsert', data: link });
    }
    await commitWrite(ops);
    return { message: 'Custom fields updated' };
  },

  // Export
  exportTransactionsCSV(params = {}) {
    return localExportCSV(params);
  },
  exportAccountsCSV() {
    return localExportAccountsCSV();
  },
  exportJSON() {
    return serverFirst(() => request('/export/json'), localExportJSON);
  },

  // PIN Lock
  async getPinStatus() {
    const local = async () => {
      const row = await getRecord('app_lock', 'app-lock');
      if (!row) return { isEnabled: false, autoLockMinutes: 5, hasPin: false, lastUnlockedAt: null };
      return {
        isEnabled: !!row.is_enabled,
        autoLockMinutes: row.auto_lock_minutes,
        hasPin: !!row.pin_hash,
        lastUnlockedAt: row.last_unlocked_at,
        pinHash: row.pin_hash || null,
      };
    };
    return serverFirst(async () => {
      const result = await request('/pin-lock/status');
      const row = pickColumns({
        id: 'app-lock',
        pin_hash: result.pinHash || null,
        is_enabled: result.isEnabled ? 1 : 0,
        auto_lock_minutes: result.autoLockMinutes,
        last_unlocked_at: result.lastUnlockedAt || null,
      }, 'app_lock');
      await putRecord('app_lock', row);
      return result;
    }, local);
  },
  async setupPin(pin) {
    if (!pin || pin.length < 4 || pin.length > 6) {
      const err = new Error('PIN must be 4-6 digits');
      err.status = 400;
      throw err;
    }
    const ts = new Date().toISOString();
    const existing = await getRecord('app_lock', 'app-lock');
    if (existing && existing.pin_hash) {
      const err = new Error('PIN already set. Use update endpoint.');
      err.status = 400;
      throw err;
    }
    const pinHash = await pinHashValue(pin);
    const row = existing
      ? { ...existing, pin_hash: pinHash, is_enabled: 1, last_unlocked_at: ts, updated_at: ts }
      : pickColumns({
        id: 'app-lock', pin_hash: pinHash, is_enabled: 1, auto_lock_minutes: 5,
        last_unlocked_at: ts, created_at: ts, updated_at: ts,
      }, 'app_lock');
    await putRecord('app_lock', row);
    await commitWrite([{ table: 'app_lock', id: 'app-lock', op: 'upsert', data: row }]);
    return { message: 'PIN set successfully', isEnabled: true };
  },
  async updatePin(oldPin, newPin) {
    const lock = await getRecord('app_lock', 'app-lock');
    if (!lock || !lock.pin_hash) {
      const err = new Error('No PIN set');
      err.status = 400;
      throw err;
    }
    if ((await pinHashValue(oldPin)) !== lock.pin_hash) {
      const err = new Error('Old PIN is incorrect');
      err.status = 403;
      throw err;
    }
    if (!newPin || newPin.length < 4 || newPin.length > 6) {
      const err = new Error('New PIN must be 4-6 digits');
      err.status = 400;
      throw err;
    }
    const row = { ...lock, pin_hash: await pinHashValue(newPin), updated_at: new Date().toISOString() };
    await putRecord('app_lock', row);
    await commitWrite([{ table: 'app_lock', id: 'app-lock', op: 'upsert', data: row }]);
    return { message: 'PIN updated successfully' };
  },
  async verifyPin(pin) {
    const lock = await getRecord('app_lock', 'app-lock');
    if (lock && lock.pin_hash) {
      if ((await pinHashValue(pin)) === lock.pin_hash) {
        const row = { ...lock, last_unlocked_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        await putRecord('app_lock', row);
        await commitWrite([{ table: 'app_lock', id: 'app-lock', op: 'upsert', data: row }]);
        return { verified: true, message: 'PIN verified' };
      }
      const err = new Error('Invalid PIN');
      err.status = 403;
      throw err;
    }
    if (isOnline()) {
      return request('/pin-lock/verify', { method: 'POST', body: { pin } });
    }
    return { verified: true, message: 'No PIN set' };
  },
  async disablePin(pin) {
    const lock = await getRecord('app_lock', 'app-lock');
    if (!lock || !lock.pin_hash) {
      const err = new Error('No PIN set');
      err.status = 400;
      throw err;
    }
    if ((await pinHashValue(pin)) !== lock.pin_hash) {
      const err = new Error('PIN is incorrect');
      err.status = 403;
      throw err;
    }
    const row = { ...lock, pin_hash: null, is_enabled: 0, updated_at: new Date().toISOString() };
    await putRecord('app_lock', row);
    await commitWrite([{ table: 'app_lock', id: 'app-lock', op: 'upsert', data: row }]);
    return { message: 'PIN disabled', isEnabled: false };
  },
  async updateAutoLock(minutes) {
    if (!minutes || minutes < 1) {
      const err = new Error('Auto-lock time must be at least 1 minute');
      err.status = 400;
      throw err;
    }
    const ts = new Date().toISOString();
    const existing = await getRecord('app_lock', 'app-lock');
    const row = existing
      ? { ...existing, auto_lock_minutes: minutes, updated_at: ts }
      : pickColumns({ id: 'app-lock', auto_lock_minutes: minutes, last_unlocked_at: ts, created_at: ts, updated_at: ts }, 'app_lock');
    await putRecord('app_lock', row);
    await commitWrite([{ table: 'app_lock', id: 'app-lock', op: 'upsert', data: row }]);
    return { message: 'Auto-lock updated', autoLockMinutes: minutes };
  },

  // Backup
  exportData() {
    return serverFirst(() => request('/backup/export'), localExportJSON);
  },
  async importData(data) {
    if (!data || !data.version) {
      const err = new Error('Invalid backup file format');
      err.status = 400;
      throw err;
    }
    const ts = new Date().toISOString();
    const snapshot = normalizeSnapshot(data, ts);

    // Remember what we currently have locally so we can emit delete ops for
    // anything the import does not contain.
    const oldRows = await getAllRecords();
    const oldByTable = {};
    for (const r of oldRows) {
      if (!oldByTable[r.table]) oldByTable[r.table] = [];
      oldByTable[r.table].push(r.data);
    }

    // 1. Replace IndexedDB first (offline-first: local is always the source).
    await clearAllRecords();
    const ops = [];
    for (const table of Object.keys(TABLE_COLUMNS)) {
      const rows = snapshot[table] || [];
      const oldIds = new Set((oldByTable[table] || []).map((r) => r.id));
      const newIds = new Set(rows.map((r) => r.id));
      for (const id of oldIds) {
        if (!newIds.has(id)) ops.push({ table, id, op: 'delete' });
      }
      for (const row of rows) {
        const clean = pickColumns(row, table);
        if (!Object.keys(clean).length) continue;
        await putRecord(table, clean);
        ops.push({ table, id: clean.id, op: 'upsert', data: clean });
      }
    }

    // 2. Then sync the whole snapshot to Neon via the outbox.
    await commitWrite(ops);
    return { message: 'Data imported successfully' };
  },
};
