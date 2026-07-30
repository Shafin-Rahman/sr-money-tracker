import { getSqlite } from '../db/index.js';

export function search(req, res) {
  const db = getSqlite();
  const { q, type, page = 1, limit = 20 } = req.query;

  if (!q || q.trim().length < 1) {
    return res.json({ transactions: [], accounts: [], categories: [], loans: [], tags: [] });
  }

  const searchTerm = `%${q.trim()}%`;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const transactions = db.prepare(`
    SELECT t.*, a.name as account_name, a.color as account_color,
      c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.is_removed = 0 AND (
      t.description LIKE ? OR t.person_name LIKE ? OR t.amount LIKE ? OR t.notes LIKE ?
    )
    ORDER BY t.date DESC
    LIMIT ? OFFSET ?
  `).all(searchTerm, searchTerm, searchTerm, searchTerm, parseInt(limit), offset);

  const accounts = db.prepare(`
    SELECT * FROM accounts
    WHERE name LIKE ? AND is_archived = 0
    LIMIT 10
  `).all(searchTerm);

  const categories = db.prepare(`
    SELECT * FROM categories
    WHERE name LIKE ? AND is_archived = 0
    LIMIT 10
  `).all(searchTerm);

  const loans = db.prepare(`
    SELECT * FROM loans
    WHERE person_name LIKE ? OR person_phone LIKE ? OR notes LIKE ?
    LIMIT 10
  `).all(searchTerm, searchTerm, searchTerm);

  const tags = db.prepare(`
    SELECT * FROM tags
    WHERE name LIKE ?
    LIMIT 10
  `).all(searchTerm);

  res.json({ transactions, accounts, categories, loans, tags });
}
