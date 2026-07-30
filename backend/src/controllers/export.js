import { getSqlite } from '../db/index.js';

export function exportCSV(req, res) {
  const db = getSqlite();
  const { startDate, endDate, type } = req.query;

  let query = `SELECT t.date, t.time, t.type, t.amount, t.description,
    a.name as account_name, c.name as category_name, t.person_name, t.notes
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.is_removed = 0`;

  const params = [];
  if (startDate) { query += ' AND t.date >= ?'; params.push(startDate); }
  if (endDate) { query += ' AND t.date <= ?'; params.push(endDate); }
  if (type) { query += ' AND t.type = ?'; params.push(type); }
  query += ' ORDER BY t.date DESC';

  const transactions = db.prepare(query).all(...params);

  const headers = ['Date', 'Time', 'Type', 'Amount', 'Description', 'Account', 'Category', 'Person', 'Notes'];
  const rows = transactions.map((t) => [
    t.date, t.time || '', t.type, t.amount, `"${(t.description || '').replace(/"/g, '""')}"`,
    t.account_name || '', t.category_name || '', t.person_name || '', `"${(t.notes || '').replace(/"/g, '""')}"`,
  ]);

  let csv = headers.join(',') + '\n';
  csv += rows.map((r) => r.join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="transactions-${startDate || 'all'}-${endDate || 'all'}.csv"`);
  res.send(csv);
}

export function exportAccountsCSV(req, res) {
  const db = getSqlite();
  const accounts = db.prepare('SELECT name, type, opening_balance, current_balance, notes FROM accounts WHERE is_archived = 0').all();

  const headers = ['Name', 'Type', 'Opening Balance', 'Current Balance', 'Notes'];
  const rows = accounts.map((a) => [a.name, a.type, a.opening_balance, a.current_balance, `"${(a.notes || '').replace(/"/g, '""')}"`]);

  let csv = headers.join(',') + '\n';
  csv += rows.map((r) => r.join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="accounts.csv"');
  res.send(csv);
}

export function exportJSON(req, res) {
  const db = getSqlite();
  const data = {
    exportedAt: new Date().toISOString(),
    transactions: db.prepare('SELECT * FROM transactions WHERE is_removed = 0').all(),
    accounts: db.prepare('SELECT * FROM accounts').all(),
    categories: db.prepare('SELECT * FROM categories').all(),
  };
  res.json(data);
}
