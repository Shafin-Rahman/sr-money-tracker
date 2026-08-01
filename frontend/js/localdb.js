const DB_NAME = 'sr-money-tracker-offline';
const DB_VERSION = 1;

export const TABLE_COLUMNS = {
  users: ['id', 'name', 'email', 'currency', 'theme', 'date_format', 'language', 'created_at', 'updated_at'],
  accounts: ['id', 'name', 'type', 'icon', 'color', 'opening_balance', 'current_balance', 'notes', 'is_active', 'is_archived', 'sort_order', 'created_at', 'updated_at'],
  categories: ['id', 'name', 'type', 'parent_id', 'icon', 'color', 'is_active', 'is_archived', 'sort_order', 'created_at', 'updated_at'],
  tags: ['id', 'name', 'color', 'created_at'],
  transactions: ['id', 'type', 'amount', 'account_id', 'to_account_id', 'category_id', 'description', 'person_name', 'person_phone', 'location', 'notes', 'date', 'time', 'is_recurring', 'recurring_interval', 'recurring_next_date', 'is_removed', 'created_at', 'updated_at'],
  transaction_tags: ['id', 'transaction_id', 'tag_id'],
  loans: ['id', 'type', 'person_name', 'person_phone', 'person_address', 'amount', 'paid_amount', 'remaining_amount', 'interest_rate', 'account_id', 'due_date', 'status', 'notes', 'created_at', 'updated_at'],
  loan_payments: ['id', 'loan_id', 'amount', 'date', 'notes', 'created_at'],
  settings: ['id', 'key', 'value', 'created_at', 'updated_at'],
  budgets: ['id', 'category_id', 'amount', 'period', 'start_date', 'end_date', 'is_active', 'created_at', 'updated_at'],
  savings_goals: ['id', 'name', 'target_amount', 'current_amount', 'account_id', 'deadline', 'icon', 'color', 'notes', 'is_active', 'created_at', 'updated_at'],
  recurring_bills: ['id', 'name', 'amount', 'category_id', 'account_id', 'interval', 'day_of_month', 'day_of_week', 'start_date', 'end_date', 'next_date', 'is_active', 'notes', 'created_at', 'updated_at'],
  custom_fields: ['id', 'name', 'type', 'is_required', 'sort_order', 'created_at', 'updated_at'],
  transaction_custom_fields: ['id', 'transaction_id', 'field_id', 'value', 'created_at'],
  app_lock: ['id', 'pin_hash', 'is_enabled', 'auto_lock_minutes', 'last_unlocked_at', 'created_at', 'updated_at'],
};

export function pickColumns(row, table) {
  const cols = TABLE_COLUMNS[table] || [];
  const out = {};
  for (const c of cols) {
    if (row[c] !== undefined) out[c] = row[c];
  }
  return out;
}

let db = null;
let readyPromise = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('records')) {
        const records = database.createObjectStore('records', { keyPath: 'key' });
        records.createIndex('by_table', 'table', { unique: false });
      }
      if (!database.objectStoreNames.contains('outbox')) {
        database.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function init() {
  if (!readyPromise) {
    readyPromise = openDb().then((database) => {
      db = database;
    });
  }
  return readyPromise;
}

function tx(storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function recordKey(table, id) {
  return `${table}:${id}`;
}

export async function putRecord(table, row) {
  const data = JSON.parse(JSON.stringify(row));
  const key = recordKey(table, data.id);
  await promisify(tx('records', 'readwrite').put({ key, table, id: data.id, data }));
}

export async function getRecord(table, id) {
  const entry = await promisify(tx('records', 'readonly').get(recordKey(table, id)));
  return entry ? entry.data : null;
}

export async function getTable(table) {
  const entries = await promisify(tx('records', 'readonly').index('by_table').getAll(table));
  return entries.map((e) => e.data);
}

export async function getAllRecords() {
  const entries = await promisify(tx('records', 'readonly').getAll());
  return entries.map((e) => e.data);
}

export async function deleteRecord(table, id) {
  await promisify(tx('records', 'readwrite').delete(recordKey(table, id)));
}

export async function clearTable(table) {
  const store = tx('records', 'readwrite');
  const index = store.index('by_table');
  const keys = await promisify(index.getAllKeys(table));
  for (const key of keys) {
    await promisify(store.delete(key));
  }
}

export async function clearAllRecords() {
  await promisify(tx('records', 'readwrite').clear());
}

export async function bulkReplace(table, rows) {
  await clearTable(table);
  const store = tx('records', 'readwrite');
  for (const row of rows) {
    if (!row || row.id === undefined) continue;
    const data = pickColumns(row, table);
    if (!Object.keys(data).length) continue;
    store.put({ key: recordKey(table, data.id), table, id: data.id, data });
  }
}

export async function cacheRows(table, rows) {
  const store = tx('records', 'readwrite');
  for (const row of rows) {
    if (!row || row.id === undefined) continue;
    const data = pickColumns(row, table);
    if (!Object.keys(data).length) continue;
    store.put({ key: recordKey(table, data.id), table, id: data.id, data });
  }
}

export async function enqueue(op) {
  await promisify(tx('outbox', 'readwrite').add({
    table: op.table,
    id: op.id,
    op: op.op,
    data: op.data ? JSON.parse(JSON.stringify(op.data)) : null,
    ts: Date.now(),
  }));
}

export async function listOutbox() {
  const entries = await promisify(tx('outbox', 'readonly').getAll());
  return entries.sort((a, b) => a.id - b.id);
}

export async function removeOutbox(ids) {
  const store = tx('outbox', 'readwrite');
  for (const id of ids) {
    await promisify(store.delete(id));
  }
}

export async function clearOutbox() {
  await promisify(tx('outbox', 'readwrite').clear());
}

export async function countOutbox() {
  const entries = await promisify(tx('outbox', 'readonly').getAll());
  return entries.length;
}

export async function getMeta(key) {
  const entry = await promisify(tx('meta', 'readonly').get(key));
  return entry ? entry.value : null;
}

export async function setMeta(key, value) {
  await promisify(tx('meta', 'readwrite').put({ key, value }));
}
