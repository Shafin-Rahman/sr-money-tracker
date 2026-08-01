import { get, all, run } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export async function list(req, res) {
  const { period, isActive } = req.query;

  let query = `SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color FROM budgets b LEFT JOIN categories c ON b.category_id = c.id WHERE 1=1`;
  const params = [];

  if (period) {
    query += ' AND b.period = ?';
    params.push(period);
  }
  if (isActive !== undefined) {
    query += ' AND b.is_active = ?';
    params.push(isActive === 'true' ? 1 : 0);
  }

  query += ' ORDER BY b.created_at DESC';

  const budgets = await all(query, ...params);

  for (const budget of budgets) {
    const spent = await get(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE category_id = ? AND type = 'expense' AND is_removed = 0
      AND date >= ? AND date <= ?
    `, budget.category_id, budget.start_date, budget.end_date || now());

    budget.spent = spent.total;
    budget.remaining = budget.amount - spent.total;
    budget.percentage = budget.amount > 0 ? Math.round((spent.total / budget.amount) * 100) : 0;
  }

  res.json(budgets);
}

export async function create(req, res) {
  const id = generateId();
  const timestamp = now();

  const { categoryId, amount, period, startDate, endDate } = req.body;

  await run(`INSERT INTO budgets (id, category_id, amount, period, start_date, end_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, categoryId || null, amount, period, startDate, endDate || null, timestamp, timestamp
  );

  const budget = await get('SELECT * FROM budgets WHERE id = ?', id);
  res.status(201).json(budget);
}

export async function update(req, res) {
  const timestamp = now();

  const existing = await get('SELECT * FROM budgets WHERE id = ?', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Budget not found' });
  }

  const { categoryId, amount, period, startDate, endDate, isActive } = req.body;

  await run(`UPDATE budgets SET
    category_id = COALESCE(?, category_id),
    amount = COALESCE(?, amount),
    period = COALESCE(?, period),
    start_date = COALESCE(?, start_date),
    end_date = ?,
    is_active = COALESCE(?, is_active),
    updated_at = ?
    WHERE id = ?`,
    categoryId || null, amount || null, period || null, startDate || null,
    endDate !== undefined ? endDate : existing.end_date,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    timestamp, req.params.id
  );

  const budget = await get('SELECT * FROM budgets WHERE id = ?', req.params.id);
  res.json(budget);
}

export async function remove(req, res) {
  const existing = await get('SELECT * FROM budgets WHERE id = ?', req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Budget not found' });
  }

  await run('DELETE FROM budgets WHERE id = ?', req.params.id);
  res.json({ message: 'Budget deleted successfully' });
}
