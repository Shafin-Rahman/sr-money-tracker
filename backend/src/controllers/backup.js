import { all, withTransaction } from '../db/index.js';
import { now } from '../utils/helpers.js';

const TABLES = [
  { name: 'users', columns: ['id', 'name', 'email', 'currency', 'theme', 'date_format', 'language', 'created_at', 'updated_at'] },
  { name: 'accounts', columns: ['id', 'name', 'type', 'icon', 'color', 'opening_balance', 'current_balance', 'notes', 'is_active', 'is_archived', 'sort_order', 'created_at', 'updated_at'] },
  { name: 'categories', columns: ['id', 'name', 'type', 'parent_id', 'icon', 'color', 'is_active', 'is_archived', 'sort_order', 'created_at', 'updated_at'] },
  { name: 'tags', columns: ['id', 'name', 'color', 'created_at'] },
  { name: 'transactions', columns: ['id', 'type', 'amount', 'account_id', 'to_account_id', 'category_id', 'description', 'person_name', 'person_phone', 'location', 'notes', 'date', 'time', 'is_recurring', 'recurring_interval', 'recurring_next_date', 'is_removed', 'created_at', 'updated_at'] },
  { name: 'transaction_tags', columns: ['id', 'transaction_id', 'tag_id'] },
  { name: 'loans', columns: ['id', 'type', 'person_name', 'person_phone', 'person_address', 'amount', 'paid_amount', 'remaining_amount', 'interest_rate', 'account_id', 'due_date', 'status', 'notes', 'created_at', 'updated_at'] },
  { name: 'loan_payments', columns: ['id', 'loan_id', 'amount', 'date', 'notes', 'created_at'] },
  { name: 'settings', columns: ['id', 'key', 'value', 'created_at', 'updated_at'] },
  { name: 'budgets', columns: ['id', 'category_id', 'amount', 'period', 'start_date', 'end_date', 'is_active', 'created_at', 'updated_at'] },
  { name: 'savings_goals', columns: ['id', 'name', 'target_amount', 'current_amount', 'account_id', 'deadline', 'icon', 'color', 'notes', 'is_active', 'created_at', 'updated_at'] },
  { name: 'recurring_bills', columns: ['id', 'name', 'amount', 'category_id', 'account_id', 'interval', 'day_of_month', 'day_of_week', 'start_date', 'end_date', 'next_date', 'is_active', 'notes', 'created_at', 'updated_at'] },
  { name: 'custom_fields', columns: ['id', 'name', 'type', 'is_required', 'sort_order', 'created_at', 'updated_at'] },
  { name: 'transaction_custom_fields', columns: ['id', 'transaction_id', 'field_id', 'value', 'created_at'] },
];

// children-first so foreign keys are satisfied
const DELETE_ORDER = [
  'transaction_custom_fields', 'transaction_tags', 'transactions', 'loan_payments',
  'loans', 'budgets', 'recurring_bills', 'savings_goals', 'custom_fields', 'tags',
  'categories', 'accounts', 'settings', 'users',
];

export async function exportData(req, res) {
  const data = {
    version: '1.0',
    exportedAt: now(),
  };
  for (const table of TABLES) {
    data[table.name] = await all(`SELECT * FROM ${table.name}`);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="money-tracker-backup-${now().split('T')[0]}.json"`);
  res.json(data);
}

export async function importData(req, res) {
  const data = req.body;

  if (!data || !data.version) {
    return res.status(400).json({ error: 'Invalid backup file format' });
  }

  try {
    await withTransaction(async (tx) => {
      for (const tableName of DELETE_ORDER) {
        await tx.run(`DELETE FROM ${tableName}`);
      }

      for (const table of TABLES) {
        const rows = data[table.name];
        if (!rows || rows.length === 0) continue;
        const placeholders = table.columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${placeholders})`;
        for (const row of rows) {
          await tx.run(sql, ...table.columns.map((c) => row[c] ?? null));
        }
      }
    });

    res.json({ message: 'Data imported successfully', importedAt: now() });
  } catch (err) {
    res.status(500).json({ error: 'Import failed', message: err.message });
  }
}
