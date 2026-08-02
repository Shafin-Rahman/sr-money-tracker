import { withTransaction } from '../db/index.js';
import { now } from '../utils/helpers.js';
import { TABLE_COLUMNS, TABLE_NAMES } from '../db/tables.js';

const HAS_UPDATED_AT = new Set(['users', 'accounts', 'categories', 'transactions', 'loans', 'settings', 'budgets', 'savings_goals', 'recurring_bills', 'custom_fields', 'app_lock']);

export async function push(req, res) {
  const { operations } = req.body || {};

  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({ error: 'operations array is required' });
  }

  const errors = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    if (!op || !TABLE_NAMES.includes(op.table) || !op.id) {
      errors.push({ index: i, error: 'invalid operation' });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Invalid operations', errors });
  }

  try {
    await withTransaction(async (tx) => {
      for (const op of operations) {
        const allowedColumns = TABLE_COLUMNS[op.table];

        if (op.op === 'delete') {
          if (op.table === 'accounts') {
            const removedTxns = await tx.all('SELECT id FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND is_removed = 1', op.id, op.id);
            for (const t of removedTxns) {
              await tx.run('DELETE FROM transaction_tags WHERE transaction_id = ?', t.id);
            }
            await tx.run('DELETE FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND is_removed = 1', op.id, op.id);
          }
          await tx.run(`DELETE FROM ${op.table} WHERE id = ?`, op.id);
          continue;
        }

        if (op.op !== 'upsert') {
          throw new Error(`Unknown operation type: ${op.op}`);
        }

        const timestamp = now();
        const row = { id: op.id, ...(op.data || {}) };

        const hasCreatedAt = allowedColumns.includes('created_at');
        const hasUpdatedAt = allowedColumns.includes('updated_at');

        if (hasCreatedAt && !row.created_at) row.created_at = timestamp;
        if (hasUpdatedAt && !row.updated_at) row.updated_at = timestamp;

        const cols = allowedColumns.filter((c) => row[c] !== undefined);
        const values = cols.map((c) => row[c]);

        if (cols.length === 0) {
          throw new Error(`No data for ${op.table}:${op.id}`);
        }

        const insertSql = `INSERT INTO ${op.table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;

        const updateCols = cols.filter((c) => c !== 'id');
        const updateSql = updateCols.length > 0
          ? ` ON CONFLICT (id) DO UPDATE SET ${updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')}`
          : '';

        await tx.run(insertSql + updateSql, ...values);
      }
    });

    res.json({ synced: operations.length, syncedAt: now() });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed', message: err.message });
  }
}
