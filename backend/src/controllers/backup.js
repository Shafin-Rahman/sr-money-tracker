import { all, withTransaction } from '../db/index.js';
import { now } from '../utils/helpers.js';
import { TABLES } from '../db/tables.js';

// children-first so foreign keys are satisfied
const DELETE_ORDER = [
  'transaction_custom_fields', 'transaction_tags', 'transactions', 'loan_payments',
  'loans', 'budgets', 'recurring_bills', 'savings_goals', 'custom_fields', 'tags',
  'categories', 'accounts', 'settings', 'users', 'app_lock',
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
