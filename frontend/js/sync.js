import { API_BASE } from './config.js';
import {
  init as initDb, listOutbox, removeOutbox, clearOutbox,
  bulkReplace, getMeta, setMeta, countOutbox,
} from './localdb.js';

const TABLES = ['users', 'accounts', 'categories', 'tags', 'transactions', 'transaction_tags', 'loans', 'loan_payments', 'settings', 'budgets', 'savings_goals', 'recurring_bills', 'custom_fields', 'transaction_custom_fields'];

let current = null;
let listeners = [];

export function onSyncStatus(cb) {
  listeners.push(cb);
}

function emit(state) {
  listeners.forEach((cb) => {
    try { cb(state); } catch (_) { /* ignore */ }
  });
}

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export async function init() {
  await initDb();
  if (!isOnline()) {
    emit({ state: 'offline', pending: await countOutbox() });
  }

  window.addEventListener('online', () => {
    emit({ state: 'online', pending: 0 });
    sync();
  });
  window.addEventListener('offline', () => {
    emit({ state: 'offline', pending: 0 });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isOnline()) sync();
  });

  if (isOnline()) {
    await sync();
  }
}

async function push() {
  const operations = await listOutbox();
  if (operations.length === 0) return true;

  const payload = operations.map((op) => ({
    table: op.table,
    id: op.id,
    op: op.op,
    data: op.op === 'delete' ? undefined : op.data,
  }));

  const response = await fetch(`${API_BASE}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operations: payload }),
  });

  if (!response.ok) {
    throw new Error('Sync push failed');
  }

  await removeOutbox(operations.map((op) => op.id));
  return true;
}

async function pull() {
  const response = await fetch(`${API_BASE}/backup/export`);
  if (!response.ok) {
    throw new Error('Sync pull failed');
  }
  const snapshot = await response.json();

  for (const table of TABLES) {
    if (Array.isArray(snapshot[table])) {
      await bulkReplace(table, snapshot[table]);
    }
  }
  await setMeta('lastSyncAt', new Date().toISOString());
}

export function sync() {
  if (current) return current;
  current = runSync().finally(() => { current = null; });
  return current;
}

async function runSync() {
  if (!isOnline()) {
    emit({ state: 'offline', pending: await countOutbox() });
    return;
  }

  emit({ state: 'syncing', pending: await countOutbox() });

  try {
    await push();
    await pull();
    const pending = await countOutbox();
    emit({ state: 'idle', pending });
  } catch (err) {
    const pending = await countOutbox();
    emit({ state: isOnline() ? 'error' : 'offline', pending, message: err.message });
  }
}

export async function getLastSyncAt() {
  return getMeta('lastSyncAt');
}

export async function resetLocal() {
  await clearOutbox();
}
