import { get, all } from '../db/index.js';
import { dateRange } from '../utils/helpers.js';

export async function getReport(req, res) {
  const { startDate, endDate, groupBy = 'category' } = req.query;

  const range = dateRange(startDate, endDate);

  let report;

  if (groupBy === 'category') {
    report = await all(`
      SELECT c.id as category_id, c.name as category_name, c.icon as category_icon,
        c.color as category_color, t.type, CAST(COUNT(*) AS INTEGER) as transaction_count, SUM(t.amount) as total_amount
      FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.date >= ? AND t.date <= ? AND t.is_removed = 0
      GROUP BY c.id, t.type ORDER BY total_amount DESC
    `, range.start, range.end);
  } else if (groupBy === 'account') {
    report = await all(`
      SELECT a.id as account_id, a.name as account_name, a.icon as account_icon,
        a.color as account_color, t.type, CAST(COUNT(*) AS INTEGER) as transaction_count, SUM(t.amount) as total_amount
      FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.date >= ? AND t.date <= ? AND t.is_removed = 0
      GROUP BY a.id, t.type ORDER BY total_amount DESC
    `, range.start, range.end);
  } else if (groupBy === 'daily') {
    report = await all(`
      SELECT t.date,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense,
        CAST(COUNT(*) AS INTEGER) as transaction_count
      FROM transactions t
      WHERE t.date >= ? AND t.date <= ? AND t.is_removed = 0
      GROUP BY t.date ORDER BY t.date ASC
    `, range.start, range.end);
  } else if (groupBy === 'tag') {
    report = await all(`
      SELECT tg.id as tag_id, tg.name as tag_name, tg.color as tag_color,
        CAST(COUNT(*) AS INTEGER) as transaction_count, SUM(t.amount) as total_amount
      FROM transactions t JOIN transaction_tags tt ON t.id = tt.transaction_id
      JOIN tags tg ON tt.tag_id = tg.id
      WHERE t.date >= ? AND t.date <= ? AND t.is_removed = 0
      GROUP BY tg.id ORDER BY total_amount DESC
    `, range.start, range.end);
  }

  const summary = await get(`
    SELECT CAST(COUNT(*) AS INTEGER) as total_transactions,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
      COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0) as total_transfer
    FROM transactions
    WHERE date >= ? AND date <= ? AND is_removed = 0
  `, range.start, range.end);

  res.json({ summary, report: report || [] });
}
