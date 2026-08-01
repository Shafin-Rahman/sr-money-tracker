import { all } from '../db/index.js';

export async function search(req, res) {
  const { q, type, page = 1, limit = 20 } = req.query;

  if (!q || q.trim().length < 1) {
    return res.json({ transactions: [], accounts: [], categories: [], loans: [], tags: [] });
  }

  const searchTerm = `%${q.trim()}%`;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const transactions = await all(`
    SELECT t.*, a.name as account_name, a.color as account_color,
      c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.is_removed = 0 AND (
      t.description LIKE ? OR t.person_name LIKE ? OR t.amount::text LIKE ? OR t.notes LIKE ?
    )
    ORDER BY t.date DESC
    LIMIT ? OFFSET ?
  `, searchTerm, searchTerm, searchTerm, searchTerm, parseInt(limit), offset);

  const accounts = await all(`
    SELECT * FROM accounts
    WHERE name LIKE ? AND is_archived = 0
    LIMIT 10
  `, searchTerm);

  const categories = await all(`
    SELECT * FROM categories
    WHERE name LIKE ? AND is_archived = 0
    LIMIT 10
  `, searchTerm);

  const loans = await all(`
    SELECT * FROM loans
    WHERE person_name LIKE ? OR person_phone LIKE ? OR notes LIKE ?
    LIMIT 10
  `, searchTerm, searchTerm, searchTerm);

  const tags = await all(`
    SELECT * FROM tags
    WHERE name LIKE ?
    LIMIT 10
  `, searchTerm);

  res.json({ transactions, accounts, categories, loans, tags });
}
