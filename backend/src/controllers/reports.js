import { getSqlite } from '../db/index.js';
import { dateRange } from '../utils/helpers.js';

export function getReport(req, res) {
  const db = getSqlite();
  const { startDate, endDate, groupBy = 'category' } = req.query;

  const range = dateRange(startDate, endDate);

  let report;

  if (groupBy === 'category') {
    report = db.prepare(`
      SELECT c.id as category_id, c.name as category_name, c.icon as category_icon,
        c.color as category_color, t.type, COUNT(*) as transaction_count, SUM(t.amount) as total_amount
      FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.date >= ? AND t.date <= ? AND t.is_removed = 0
      GROUP BY c.id, t.type ORDER BY total_amount DESC
    `).all(range.start, range.end);
  } else if (groupBy === 'account') {
    report = db.prepare(`
      SELECT a.id as account_id, a.name as account_name, a.icon as account_icon,
        a.color as account_color, t.type, COUNT(*) as transaction_count, SUM(t.amount) as total_amount
      FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.date >= ? AND t.date <= ? AND t.is_removed = 0
      GROUP BY a.id, t.type ORDER BY total_amount DESC
    `).all(range.start, range.end);
  } else if (groupBy === 'daily') {
    report = db.prepare(`
      SELECT t.date,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense,
        COUNT(*) as transaction_count
      FROM transactions t
      WHERE t.date >= ? AND t.date <= ? AND t.is_removed = 0
      GROUP BY t.date ORDER BY t.date ASC
    `).all(range.start, range.end);
  } else if (groupBy === 'tag') {
    report = db.prepare(`
      SELECT tg.id as tag_id, tg.name as tag_name, tg.color as tag_color,
        COUNT(*) as transaction_count, SUM(t.amount) as total_amount
      FROM transactions t JOIN transaction_tags tt ON t.id = tt.transaction_id
      JOIN tags tg ON tt.tag_id = tg.id
      WHERE t.date >= ? AND t.date <= ? AND t.is_removed = 0
      GROUP BY tg.id ORDER BY total_amount DESC
    `).all(range.start, range.end);
  }

  const summary = db.prepare(`
    SELECT COUNT(*) as total_transactions,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
      COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0) as total_transfer
    FROM transactions
    WHERE date >= ? AND date <= ? AND is_removed = 0
  `).get(range.start, range.end);

  res.json({ summary, report: report || [] });
}
