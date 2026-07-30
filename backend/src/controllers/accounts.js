import { getSqlite } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export function list(req, res) {
  const db = getSqlite();
  const includeArchived = req.query.include_archived === 'true';

  let query = 'SELECT * FROM accounts WHERE 1=1';
  const params = [];

  if (!includeArchived) {
    query += ' AND is_archived = 0';
  }

  query += ' ORDER BY sort_order ASC, name ASC';

  const accounts = db.prepare(query).all(...params);
  res.json(accounts);
}

export function getById(req, res) {
  const db = getSqlite();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  res.json(account);
}

export function create(req, res) {
  const db = getSqlite();
  const id = generateId();
  const timestamp = now();

  const { name, type, icon, color, openingBalance, notes } = req.body;

  db.prepare(`INSERT INTO accounts (id, name, type, icon, color, opening_balance, current_balance, notes, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM accounts), ?, ?)`).run(
    id, name, type || 'custom', icon || 'wallet', color || '#6366f1',
    openingBalance || 0, openingBalance || 0, notes || null, timestamp, timestamp
  );

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  res.status(201).json(account);
}

export function update(req, res) {
  const db = getSqlite();
  const timestamp = now();

  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const { name, type, icon, color, notes, isActive, isArchived, sortOrder } = req.body;

  db.prepare(`UPDATE accounts SET
    name = COALESCE(?, name),
    type = COALESCE(?, type),
    icon = COALESCE(?, icon),
    color = COALESCE(?, color),
    notes = COALESCE(?, notes),
    is_active = COALESCE(?, is_active),
    is_archived = COALESCE(?, is_archived),
    sort_order = COALESCE(?, sort_order),
    updated_at = ?
    WHERE id = ?`).run(
    name || null, type || null, icon || null, color || null,
    notes !== undefined ? notes : null,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    isArchived !== undefined ? (isArchived ? 1 : 0) : null,
    sortOrder || null, timestamp, req.params.id
  );

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  res.json(account);
}

export function remove(req, res) {
  const db = getSqlite();
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Account not found' });
  }

  db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Account deleted successfully' });
}

export function getBalance(req, res) {
  const db = getSqlite();

  const accounts = db.prepare('SELECT id, name, type, icon, color, current_balance, opening_balance FROM accounts WHERE is_archived = 0').all();

  const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  res.json({ accounts, totalBalance });
}
