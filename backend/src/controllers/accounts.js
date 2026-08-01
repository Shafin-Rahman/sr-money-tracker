import { get, all, run } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export async function list(req, res) {
  const includeArchived = req.query.include_archived === 'true';

  let query = 'SELECT * FROM accounts WHERE 1=1';
  const params = [];

  if (!includeArchived) {
    query += ' AND is_archived = 0';
  }

  query += ' ORDER BY sort_order ASC, name ASC';

  const accounts = await all(query, ...params);
  res.json(accounts);
}

export async function getById(req, res) {
  const account = await get('SELECT * FROM accounts WHERE id = ?', req.params.id);

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  res.json(account);
}

export async function create(req, res) {
  const id = generateId();
  const timestamp = now();

  const { name, type, icon, color, openingBalance, notes } = req.body;

  await run(`INSERT INTO accounts (id, name, type, icon, color, opening_balance, current_balance, notes, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM accounts), ?, ?)`,
    id, name, type || 'custom', icon || 'wallet', color || '#6366f1',
    openingBalance || 0, openingBalance || 0, notes || null, timestamp, timestamp
  );

  const account = await get('SELECT * FROM accounts WHERE id = ?', id);
  res.status(201).json(account);
}

export async function update(req, res) {
  const timestamp = now();

  const existing = await get('SELECT * FROM accounts WHERE id = ?', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const { name, type, icon, color, notes, isActive, isArchived, sortOrder } = req.body;

  await run(`UPDATE accounts SET
    name = COALESCE(?, name),
    type = COALESCE(?, type),
    icon = COALESCE(?, icon),
    color = COALESCE(?, color),
    notes = COALESCE(?, notes),
    is_active = COALESCE(?, is_active),
    is_archived = COALESCE(?, is_archived),
    sort_order = COALESCE(?, sort_order),
    updated_at = ?
    WHERE id = ?`,
    name || null, type || null, icon || null, color || null,
    notes !== undefined ? notes : null,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    isArchived !== undefined ? (isArchived ? 1 : 0) : null,
    sortOrder || null, timestamp, req.params.id
  );

  const account = await get('SELECT * FROM accounts WHERE id = ?', req.params.id);
  res.json(account);
}

export async function remove(req, res) {
  const existing = await get('SELECT * FROM accounts WHERE id = ?', req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Account not found' });
  }

  await run('DELETE FROM accounts WHERE id = ?', req.params.id);
  res.json({ message: 'Account deleted successfully' });
}

export async function getBalance(req, res) {
  const accounts = await all('SELECT id, name, type, icon, color, current_balance, opening_balance FROM accounts WHERE is_archived = 0');

  const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  res.json({ accounts, totalBalance });
}
