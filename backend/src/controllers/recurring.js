import { get, all, run } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export async function list(req, res) {
  const bills = await all(`SELECT rb.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
    a.name as account_name, a.color as account_color
    FROM recurring_bills rb
    LEFT JOIN categories c ON rb.category_id = c.id
    LEFT JOIN accounts a ON rb.account_id = a.id
    ORDER BY rb.next_date ASC`);
  res.json(bills);
}

export async function getById(req, res) {
  const bill = await get(`SELECT rb.*, c.name as category_name, c.color as category_color,
    a.name as account_name FROM recurring_bills rb
    LEFT JOIN categories c ON rb.category_id = c.id
    LEFT JOIN accounts a ON rb.account_id = a.id WHERE rb.id = ?`, req.params.id);
  if (!bill) return res.status(404).json({ error: 'Recurring bill not found' });
  res.json(bill);
}

export async function create(req, res) {
  const id = generateId();
  const timestamp = now();

  const { name, amount, categoryId, accountId, interval, dayOfMonth, dayOfWeek, startDate, endDate, notes } = req.body;

  const nextDate = calculateNextDate(interval, dayOfMonth, dayOfWeek, startDate);

  await run(`INSERT INTO recurring_bills (id, name, amount, category_id, account_id, interval, day_of_month, day_of_week, start_date, end_date, next_date, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, name, amount, categoryId || null, accountId || null, interval,
    dayOfMonth || null, dayOfWeek || null, startDate, endDate || null,
    nextDate, notes || null, timestamp, timestamp
  );

  const bill = await get('SELECT * FROM recurring_bills WHERE id = ?', id);
  res.status(201).json(bill);
}

export async function update(req, res) {
  const timestamp = now();
  const existing = await get('SELECT * FROM recurring_bills WHERE id = ?', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Recurring bill not found' });

  const { name, amount, categoryId, accountId, interval, dayOfMonth, dayOfWeek, startDate, endDate, isActive, notes } = req.body;

  await run(`UPDATE recurring_bills SET
    name = COALESCE(?, name), amount = COALESCE(?, amount),
    category_id = ?, account_id = ?, interval = COALESCE(?, interval),
    day_of_month = ?, day_of_week = ?, start_date = COALESCE(?, start_date),
    end_date = ?, is_active = COALESCE(?, is_active),
    notes = ?, updated_at = ? WHERE id = ?`,
    name || null, amount || null,
    categoryId !== undefined ? categoryId : existing.category_id,
    accountId !== undefined ? accountId : existing.account_id,
    interval || null,
    dayOfMonth !== undefined ? dayOfMonth : existing.day_of_month,
    dayOfWeek !== undefined ? dayOfWeek : existing.day_of_week,
    startDate || null,
    endDate !== undefined ? endDate : existing.end_date,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    notes !== undefined ? notes : existing.notes, timestamp, req.params.id
  );

  const bill = await get('SELECT * FROM recurring_bills WHERE id = ?', req.params.id);
  res.json(bill);
}

export async function remove(req, res) {
  const existing = await get('SELECT * FROM recurring_bills WHERE id = ?', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Recurring bill not found' });
  await run('DELETE FROM recurring_bills WHERE id = ?', req.params.id);
  res.json({ message: 'Recurring bill deleted' });
}

function calculateNextDate(interval, dayOfMonth, dayOfWeek, startDate) {
  const now = new Date();
  const start = startDate ? new Date(startDate) : now;

  if (interval === 'daily') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  if (interval === 'weekly') {
    const d = new Date(now);
    const targetDay = dayOfWeek || 0;
    const diff = targetDay - d.getDay();
    d.setDate(d.getDate() + (diff > 0 ? diff : diff + 7));
    return d.toISOString().split('T')[0];
  }
  if (interval === 'monthly') {
    const d = new Date(now);
    const day = dayOfMonth || 1;
    d.setDate(day);
    if (d < now) d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  }
  if (interval === 'yearly') {
    const d = new Date(start);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  }
  return start.toISOString().split('T')[0];
}
