import { getTable, putRecord } from './localdb.js';
import { today } from './utils.js';

export function nowISO() {
  return new Date().toISOString();
}

function activeAccounts(accounts) {
  return accounts.filter((a) => a.is_archived === 0);
}

function visibleTransactions(transactions) {
  return transactions.filter((t) => t.is_removed === 0);
}

export async function loadAll() {
  const [accounts, categories, tags, transactions, transactionTags, loans, loanPayments, savingsGoals, settings, budgets, recurringBills, customFields, txnCustomFields, users] = await Promise.all([
    getTable('accounts'),
    getTable('categories'),
    getTable('tags'),
    getTable('transactions'),
    getTable('transaction_tags'),
    getTable('loans'),
    getTable('loan_payments'),
    getTable('savings_goals'),
    getTable('settings'),
    getTable('budgets'),
    getTable('recurring_bills'),
    getTable('custom_fields'),
    getTable('transaction_custom_fields'),
    getTable('users'),
  ]);

  return {
    accounts,
    categories,
    tags,
    transactions,
    transactionTags,
    loans,
    loanPayments,
    savingsGoals,
    settings,
    budgets,
    recurringBills,
    customFields,
    txnCustomFields,
    users,
  };
}

export function joinTransaction(t, d) {
  const account = (d.accounts || []).find((a) => a.id === t.account_id);
  const toAccount = (d.accounts || []).find((a) => a.id === t.to_account_id);
  const category = (d.categories || []).find((c) => c.id === t.category_id);
  const tags = (d.tags || []).filter((tg) =>
    (d.transactionTags || []).some((tt) => tt.transaction_id === t.id && tt.tag_id === tg.id)
  );

  return {
    ...t,
    account_name: account ? account.name : null,
    account_icon: account ? account.icon : null,
    account_color: account ? account.color : null,
    to_account_name: toAccount ? toAccount.name : null,
    category_name: category ? category.name : null,
    category_icon: category ? category.icon : null,
    category_color: category ? category.color : null,
    tags,
  };
}

export function joinTransactions(transactions, d) {
  return transactions.map((t) => joinTransaction(t, d));
}

export async function getTransactions(params = {}) {
  const d = await loadAll();
  const { type, accountId, categoryId, startDate, endDate, page = 1, limit = 50 } = params;

  let list = visibleTransactions(d.transactions);

  if (type) list = list.filter((t) => t.type === type);
  if (accountId) list = list.filter((t) => t.account_id === accountId || t.to_account_id === accountId);
  if (categoryId) list = list.filter((t) => t.category_id === categoryId);
  if (startDate) list = list.filter((t) => t.date >= startDate);
  if (endDate) list = list.filter((t) => t.date <= endDate);

  list.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  const total = list.length;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const pageRows = list.slice(offset, offset + parseInt(limit));

  return { transactions: joinTransactions(pageRows, d), total, page: parseInt(page), limit: parseInt(limit) };
}

export async function getTransaction(id) {
  const d = await loadAll();
  const t = d.transactions.find((x) => x.id === id);
  if (!t) {
    const err = new Error('Transaction not found');
    err.status = 404;
    throw err;
  }
  return joinTransaction(t, d);
}

export async function getAccountBalance() {
  const accounts = activeAccounts(await getTable('accounts'));
  const list = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    icon: a.icon,
    color: a.color,
    current_balance: a.current_balance,
    opening_balance: a.opening_balance,
  }));
  return { accounts: list, totalBalance: list.reduce((sum, a) => sum + a.current_balance, 0) };
}

export async function getDashboardSummary() {
  const d = await loadAll();
  const currentDate = today();
  const currentMonth = currentDate.substring(0, 7);

  const activeAccs = activeAccounts(d.accounts);
  const txns = visibleTransactions(d.transactions);

  const sum = (arr, fn) => arr.reduce((acc, x) => acc + fn(x), 0);

  const totalBalance = sum(activeAccs, (a) => a.current_balance);
  const todayIncome = sum(txns.filter((t) => t.type === 'income' && t.date === currentDate), (t) => t.amount);
  const todayExpense = sum(txns.filter((t) => t.type === 'expense' && t.date === currentDate), (t) => t.amount);
  const monthlyIncome = sum(txns.filter((t) => t.type === 'income' && t.date.startsWith(currentMonth)), (t) => t.amount);
  const monthlyExpense = sum(txns.filter((t) => t.type === 'expense' && t.date.startsWith(currentMonth)), (t) => t.amount);

  const lent = sum(d.loans.filter((l) => l.type === 'lent' && l.status === 'active'), (l) => l.remaining_amount);
  const borrowed = sum(d.loans.filter((l) => l.type === 'borrowed' && l.status === 'active'), (l) => l.remaining_amount);

  const recent = [...txns].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.created_at || '').localeCompare(a.created_at || '');
  }).slice(0, 10);

  const upcomingBills = [...d.recurringBills]
    .filter((b) => b.is_active === 1 && b.next_date >= currentDate)
    .sort((a, b) => a.next_date.localeCompare(b.next_date))
    .slice(0, 5);

  const accountBalances = [...activeAccs]
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((a) => ({ id: a.id, name: a.name, type: a.type, icon: a.icon, color: a.color, current_balance: a.current_balance }));

  return {
    totalBalance,
    todayIncome,
    todayExpense,
    todayBalance: todayIncome - todayExpense,
    monthlyIncome,
    monthlyExpense,
    monthlySavings: monthlyIncome - monthlyExpense,
    netWorth: totalBalance - borrowed,
    pendingLoans: lent,
    pendingBorrowed: borrowed,
    recentTransactions: joinTransactions(recent, d),
    accountBalances,
    upcomingBills,
    date: currentDate,
  };
}

export async function getMonthlyStats(year = new Date().getFullYear()) {
  const txns = visibleTransactions(await getTable('transactions'));
  const prefix = `${year}-`;

  const byMonth = {};
  txns.filter((t) => t.date.startsWith(prefix)).forEach((t) => {
    const m = t.date.slice(5, 7);
    if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0 };
    if (t.type === 'income') byMonth[m].income += t.amount;
    if (t.type === 'expense') byMonth[m].expense += t.amount;
  });

  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    const found = byMonth[m] || { income: 0, expense: 0 };
    return {
      month: m,
      monthName: new Date(`${year}-${m}-01`).toLocaleString('default', { month: 'short' }),
      income: found.income,
      expense: found.expense,
    };
  });
}

export async function getReports(params = {}) {
  const d = await loadAll();
  const { startDate, endDate, groupBy = 'category' } = params;
  const start = startDate || '0001-01-01';
  const end = endDate || '9999-12-31';

  const txns = visibleTransactions(d.transactions).filter((t) => t.date >= start && t.date <= end);

  const summary = {
    total_transactions: txns.length,
    total_income: txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    total_expense: txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    total_transfer: txns.filter((t) => t.type === 'transfer').reduce((s, t) => s + t.amount, 0),
  };

  let report = [];

  if (groupBy === 'daily') {
    const byDate = {};
    txns.forEach((t) => {
      if (!byDate[t.date]) byDate[t.date] = { income: 0, expense: 0, transaction_count: 0 };
      byDate[t.date].transaction_count += 1;
      if (t.type === 'income') byDate[t.date].income += t.amount;
      if (t.type === 'expense') byDate[t.date].expense += t.amount;
    });
    report = Object.keys(byDate).sort().map((date) => ({ date, ...byDate[date] }));
  } else if (groupBy === 'account') {
    const groups = {};
    txns.forEach((t) => {
      const acc = (d.accounts || []).find((a) => a.id === t.account_id);
      const key = `${t.account_id || 'none'}|${t.type}`;
      if (!groups[key]) {
        groups[key] = {
          account_id: acc ? acc.id : null,
          account_name: acc ? acc.name : null,
          account_icon: acc ? acc.icon : null,
          account_color: acc ? acc.color : null,
          type: t.type,
          transaction_count: 0,
          total_amount: 0,
        };
      }
      groups[key].transaction_count += 1;
      groups[key].total_amount += t.amount;
    });
    report = Object.values(groups).sort((a, b) => b.total_amount - a.total_amount);
  } else if (groupBy === 'tag') {
    const groups = {};
    txns.forEach((t) => {
      (d.transactionTags || []).filter((tt) => tt.transaction_id === t.id).forEach((tt) => {
        const tag = (d.tags || []).find((g) => g.id === tt.tag_id);
        if (!groups[tt.tag_id]) {
          groups[tt.tag_id] = {
            tag_id: tt.tag_id,
            tag_name: tag ? tag.name : null,
            tag_color: tag ? tag.color : null,
            transaction_count: 0,
            total_amount: 0,
          };
        }
        groups[tt.tag_id].transaction_count += 1;
        groups[tt.tag_id].total_amount += t.amount;
      });
    });
    report = Object.values(groups).sort((a, b) => b.total_amount - a.total_amount);
  } else {
    const groups = {};
    txns.forEach((t) => {
      const cat = (d.categories || []).find((c) => c.id === t.category_id);
      const key = `${t.category_id || 'none'}|${t.type}`;
      if (!groups[key]) {
        groups[key] = {
          category_id: cat ? cat.id : null,
          category_name: cat ? cat.name : null,
          category_icon: cat ? cat.icon : null,
          category_color: cat ? cat.color : null,
          type: t.type,
          transaction_count: 0,
          total_amount: 0,
        };
      }
      groups[key].transaction_count += 1;
      groups[key].total_amount += t.amount;
    });
    report = Object.values(groups).sort((a, b) => b.total_amount - a.total_amount);
  }

  return { summary, report };
}

export async function search(q) {
  const d = await loadAll();
  const term = q.trim().toLowerCase();

  if (!term) return { transactions: [], accounts: [], categories: [], loans: [], tags: [] };

  const matches = (row, fields) => fields.some((f) => String(row[f] == null ? '' : row[f]).toLowerCase().includes(term));

  const transactions = visibleTransactions(d.transactions)
    .filter((t) => matches(t, ['description', 'person_name', 'notes']) || String(t.amount).includes(term))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)
    .map((t) => joinTransaction(t, d));

  const accounts = activeAccounts(d.accounts).filter((a) => matches(a, ['name'])).slice(0, 10);
  const categories = (d.categories || []).filter((c) => c.is_archived === 0 && matches(c, ['name'])).slice(0, 10);
  const loans = (d.loans || []).filter((l) => matches(l, ['person_name', 'person_phone', 'notes'])).slice(0, 10);
  const tags = (d.tags || []).filter((t) => matches(t, ['name'])).slice(0, 10);

  return { transactions, accounts, categories, loans, tags };
}

export async function exportJSON() {
  const d = await loadAll();
  return {
    version: '1.0',
    exportedAt: nowISO(),
    users: d.users || [],
    accounts: d.accounts || [],
    categories: d.categories || [],
    tags: d.tags || [],
    transactions: d.transactions || [],
    transaction_tags: d.transactionTags || [],
    loans: d.loans || [],
    loan_payments: d.loanPayments || [],
    settings: d.settings || [],
    budgets: d.budgets || [],
    savings_goals: d.savingsGoals || [],
    recurring_bills: d.recurringBills || [],
    custom_fields: d.customFields || [],
    transaction_custom_fields: d.txnCustomFields || [],
  };
}

function escCsv(val) {
  return `"${String(val == null ? '' : val).replace(/"/g, '""')}"`;
}

export async function exportTransactionsCSV(params = {}) {
  const d = await loadAll();
  const { startDate, endDate, type } = params;
  let list = visibleTransactions(d.transactions);
  if (startDate) list = list.filter((t) => t.date >= startDate);
  if (endDate) list = list.filter((t) => t.date <= endDate);
  if (type) list = list.filter((t) => t.type === type);
  list.sort((a, b) => b.date.localeCompare(a.date));
  const joined = joinTransactions(list, d);

  const headers = ['Date', 'Time', 'Type', 'Amount', 'Description', 'Account', 'Category', 'Person', 'Notes'];
  const rows = joined.map((t) => [
    t.date, t.time || '', t.type, t.amount,
    escCsv(t.description || ''), t.account_name || '', t.category_name || '',
    t.person_name || '', escCsv(t.notes || ''),
  ]);
  return headers.join(',') + '\n' + rows.map((r) => r.join(',')).join('\n');
}

export async function exportAccountsCSV() {
  const accounts = activeAccounts(await getTable('accounts'));
  const headers = ['Name', 'Type', 'Opening Balance', 'Current Balance', 'Notes'];
  const rows = accounts.map((a) => [a.name, a.type, a.opening_balance, a.current_balance, escCsv(a.notes || '')]);
  return headers.join(',') + '\n' + rows.map((r) => r.join(',')).join('\n');
}

export async function recomputeBalances() {
  const d = await loadAll();
  const txns = visibleTransactions(d.transactions);
  const now = nowISO();

  // Canonical account balance:
  //   opening_balance
  //   + income          (money in)
  //   - expense         (money out)
  //   - transfer out / + transfer in
  //   + loan_received / - loan_given transactions
  //   + active borrowed remaining / - active lent remaining   (loan principal + repayments)
  //   - savings_goals.current_amount                           (money reserved for goals)
  const activeLoans = (d.loans || []).filter((l) => l.status === 'active');
  const activeGoals = (d.savingsGoals || []).filter((g) => g.is_active === 1);

  const changed = [];

  for (const acc of d.accounts) {
    let balance = acc.opening_balance || 0;

    for (const t of txns) {
      if (t.type === 'income') {
        if (t.account_id === acc.id) balance += t.amount;
      } else if (t.type === 'expense') {
        if (t.account_id === acc.id) balance -= t.amount;
      } else if (t.type === 'transfer') {
        if (t.account_id === acc.id) balance -= t.amount;
        if (t.to_account_id === acc.id) balance += t.amount;
      } else if (t.type === 'loan_received') {
        if (t.account_id === acc.id) balance += t.amount;
      } else if (t.type === 'loan_given') {
        if (t.account_id === acc.id) balance -= t.amount;
      }
    }

    for (const loan of activeLoans) {
      if (loan.account_id !== acc.id) continue;
      if (loan.type === 'lent') balance -= loan.remaining_amount || 0;
      if (loan.type === 'borrowed') balance += loan.remaining_amount || 0;
    }

    for (const goal of activeGoals) {
      if (goal.account_id === acc.id) balance -= goal.current_amount || 0;
    }

    const rounded = Math.round(balance * 100) / 100;
    if (acc.current_balance !== rounded) {
      acc.current_balance = rounded;
      acc.updated_at = now;
      await putRecord('accounts', acc);
      changed.push(acc);
    }
  }

  return changed;
}

// Spending window used for budget progress. For ongoing budgets (no end date)
// the window is clamped to the CURRENT calendar period, otherwise a budget
// would keep accumulating spending forever and never reset.
export function budgetWindow(budget, nowDate) {
  const now = nowDate || today();
  if (budget.end_date) {
    return { start: budget.start_date || '0001-01-01', end: budget.end_date };
  }
  const start = budget.start_date || '0001-01-01';
  const period = budget.period || 'monthly';

  if (period === 'daily') return { start: now, end: now };
  if (period === 'weekly') {
    const d = new Date(`${now}T00:00:00`);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    const from = toDateStr(monday);
    return { start: from > start ? from : start, end: now };
  }
  if (period === 'monthly') {
    const from = now.substring(0, 7) + '-01';
    return { start: from > start ? from : start, end: now };
  }
  if (period === 'yearly') {
    const from = now.substring(0, 4) + '-01-01';
    return { start: from > start ? from : start, end: now };
  }
  return { start, end: now };
}

function toDateStr(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
