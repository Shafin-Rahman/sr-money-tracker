import { get, all, run } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

// Spending window for budget progress. For ongoing budgets (no end date) the
// window is clamped to the CURRENT calendar period, matching the frontend
// `budgetWindow()` in frontend/js/offlineCompute.js.
function budgetWindow(budget, todayStr) {
  if (budget.end_date) {
    return { start: budget.start_date, end: budget.end_date };
  }
  const start = budget.start_date || '0001-01-01';
  const period = budget.period || 'monthly';

  if (period === 'daily') return { start: todayStr, end: todayStr };
  if (period === 'weekly') {
    const d = new Date(`${todayStr}T00:00:00`);
    const day = d.getDay();
    d.setDate(d.getDate() - ((day + 6) % 7));
    const from = toDateStr(d);
    return { start: from > start ? from : start, end: todayStr };
  }
  if (period === 'monthly') {
    const from = todayStr.substring(0, 7) + '-01';
    return { start: from > start ? from : start, end: todayStr };
  }
  if (period === 'yearly') {
    const from = todayStr.substring(0, 4) + '-01-01';
    return { start: from > start ? from : start, end: todayStr };
  }
  return { start, end: todayStr };
}

function toDateStr(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

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
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const budget of budgets) {
    const win = budgetWindow(budget, todayStr);
    // Overall budget (category_id is null) counts ALL expense transactions.
    let spentQuery = `SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'expense' AND is_removed = 0
      AND date >= ? AND date <= ?`;
    const spentParams = [win.start, win.end];
    if (budget.category_id) {
      spentQuery += ' AND category_id = ?';
      spentParams.push(budget.category_id);
    }
    const spent = await get(spentQuery, ...spentParams);

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
