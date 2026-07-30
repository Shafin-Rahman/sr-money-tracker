import { getSqlite } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export function list(req, res) {
  const db = getSqlite();
  const { type, accountId, categoryId, startDate, endDate, page = 1, limit = 50 } = req.query;

  let query = `SELECT t.*, a.name as account_name, a.icon as account_icon, a.color as account_color,
    ta.name as to_account_name,
    c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN accounts ta ON t.to_account_id = ta.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.is_removed = 0`;

  const params = [];

  if (type) {
    query += ' AND t.type = ?';
    params.push(type);
  }
  if (accountId) {
    query += ' AND (t.account_id = ? OR t.to_account_id = ?)';
    params.push(accountId, accountId);
  }
  if (categoryId) {
    query += ' AND t.category_id = ?';
    params.push(categoryId);
  }
  if (startDate) {
    query += ' AND t.date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND t.date <= ?';
    params.push(endDate);
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const countQuery = `SELECT COUNT(*) as total FROM transactions t WHERE t.is_removed = 0` +
    (type ? ' AND t.type = ?' : '') +
    (accountId ? ' AND (t.account_id = ? OR t.to_account_id = ?)' : '') +
    (categoryId ? ' AND t.category_id = ?' : '') +
    (startDate ? ' AND t.date >= ?' : '') +
    (endDate ? ' AND t.date <= ?' : '');
  const countParams = [];
  if (type) countParams.push(type);
  if (accountId) countParams.push(accountId, accountId);
  if (categoryId) countParams.push(categoryId);
  if (startDate) countParams.push(startDate);
  if (endDate) countParams.push(endDate);
  const total = db.prepare(countQuery).get(...countParams);

  query += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const transactions = db.prepare(query).all(...params);

  const tagsQuery = `SELECT tt.transaction_id, tg.id, tg.name, tg.color
    FROM transaction_tags tt
    JOIN tags tg ON tt.tag_id = tg.id
    WHERE tt.transaction_id IN (${transactions.map(() => '?').join(',')})`;

  if (transactions.length > 0) {
    const tags = db.prepare(tagsQuery).all(...transactions.map((t) => t.id));
    const tagsByTxn = {};
    tags.forEach((tag) => {
      if (!tagsByTxn[tag.transaction_id]) tagsByTxn[tag.transaction_id] = [];
      tagsByTxn[tag.transaction_id].push(tag);
    });
    transactions.forEach((t) => {
      t.tags = tagsByTxn[t.id] || [];
    });
  }

  res.json({ transactions, total: total.total, page: parseInt(page), limit: parseInt(limit) });
}

export function getById(req, res) {
  const db = getSqlite();
  const transaction = db.prepare(`SELECT t.*, a.name as account_name, a.icon as account_icon, a.color as account_color,
    ta.name as to_account_name,
    c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN accounts ta ON t.to_account_id = ta.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?`).get(req.params.id);

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  transaction.tags = db.prepare(`SELECT tg.* FROM transaction_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE tt.transaction_id = ?`).all(req.params.id);

  res.json(transaction);
}

export function create(req, res) {
  const db = getSqlite();
  const id = generateId();
  const timestamp = now();

  const { type, amount, accountId, toAccountId, categoryId, description,
    personName, personPhone, location, notes, date, time, tags: tagIds } = req.body;

  if (amount < 0) {
    return res.status(400).json({ error: 'Amount cannot be negative' });
  }

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  db.prepare(`INSERT INTO transactions (id, type, amount, account_id, to_account_id, category_id,
    description, person_name, person_phone, location, notes, date, time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, type, amount, accountId, toAccountId || null, categoryId || null,
    description || null, personName || null, personPhone || null,
    location || null, notes || null, date, time || null, timestamp, timestamp
  );

  updateAccountBalance(db, accountId);

  if (toAccountId) {
    updateAccountBalance(db, toAccountId);
  }

  if (tagIds && tagIds.length > 0) {
    const insertTag = db.prepare('INSERT INTO transaction_tags (id, transaction_id, tag_id) VALUES (?, ?, ?)');
    tagIds.forEach((tagId) => {
      insertTag.run(generateId(), id, tagId);
    });
  }

  const transaction = db.prepare(`SELECT t.*, a.name as account_name,
    c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?`).get(id);

  res.status(201).json(transaction);
}

export function update(req, res) {
  const db = getSqlite();
  const timestamp = now();

  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const { type, amount, accountId, toAccountId, categoryId, description,
    personName, personPhone, location, notes, date, time, tags: tagIds, isRemoved } = req.body;

  db.prepare(`UPDATE transactions SET
    type = COALESCE(?, type),
    amount = COALESCE(?, amount),
    account_id = COALESCE(?, account_id),
    to_account_id = ?,
    category_id = ?,
    description = COALESCE(?, description),
    person_name = COALESCE(?, person_name),
    person_phone = COALESCE(?, person_phone),
    location = COALESCE(?, location),
    notes = COALESCE(?, notes),
    date = COALESCE(?, date),
    time = COALESCE(?, time),
    is_removed = COALESCE(?, is_removed),
    updated_at = ?
    WHERE id = ?`).run(
    type || null, amount || null, accountId || null,
    toAccountId !== undefined ? toAccountId : existing.to_account_id,
    categoryId !== undefined ? categoryId : existing.category_id,
    description || null, personName || null, personPhone || null,
    location || null, notes || null, date || null, time || null,
    isRemoved !== undefined ? (isRemoved ? 1 : 0) : null,
    timestamp, req.params.id
  );

  if (tagIds !== undefined) {
    db.prepare('DELETE FROM transaction_tags WHERE transaction_id = ?').run(req.params.id);
    if (tagIds.length > 0) {
      const insertTag = db.prepare('INSERT INTO transaction_tags (id, transaction_id, tag_id) VALUES (?, ?, ?)');
      tagIds.forEach((tagId) => {
        insertTag.run(generateId(), req.params.id, tagId);
      });
    }
  }

  const oldAccountId = existing.account_id;
  const newAccountId = accountId || existing.account_id;
  updateAccountBalance(db, oldAccountId);
  if (newAccountId !== oldAccountId) {
    updateAccountBalance(db, newAccountId);
  }

  const transaction = db.prepare(`SELECT t.*, a.name as account_name,
    c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?`).get(req.params.id);

  res.json(transaction);
}

export function remove(req, res) {
  const db = getSqlite();
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  db.prepare('UPDATE transactions SET is_removed = 1, updated_at = ? WHERE id = ?').run(now(), req.params.id);
  updateAccountBalance(db, existing.account_id);

  res.json({ message: 'Transaction removed successfully' });
}

export function duplicate(req, res) {
  const db = getSqlite();
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const newId = generateId();
  const timestamp = now();

  db.prepare(`INSERT INTO transactions (id, type, amount, account_id, to_account_id, category_id,
    description, person_name, person_phone, location, notes, date, time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    newId, existing.type, existing.amount, existing.account_id, existing.to_account_id,
    existing.category_id, existing.description, existing.person_name, existing.person_phone,
    existing.location, existing.notes, existing.date, existing.time, timestamp, timestamp
  );

  const oldTags = db.prepare('SELECT tag_id FROM transaction_tags WHERE transaction_id = ?').all(req.params.id);
  oldTags.forEach((t) => {
    db.prepare('INSERT INTO transaction_tags (id, transaction_id, tag_id) VALUES (?, ?, ?)').run(generateId(), newId, t.tag_id);
  });

  updateAccountBalance(db, existing.account_id);

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(newId);
  res.status(201).json(transaction);
}

function updateAccountBalance(db, accountId) {
  const result = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
      COALESCE(SUM(CASE WHEN type = 'transfer' AND account_id = ? THEN amount ELSE 0 END), 0) as total_transfer_out,
      COALESCE(SUM(CASE WHEN type = 'transfer' AND to_account_id = ? THEN amount ELSE 0 END), 0) as total_transfer_in,
      COALESCE(SUM(CASE WHEN type = 'loan_received' THEN amount ELSE 0 END), 0) as total_loan_in,
      COALESCE(SUM(CASE WHEN type = 'loan_given' THEN amount ELSE 0 END), 0) as total_loan_out
    FROM transactions
    WHERE (account_id = ? OR to_account_id = ?) AND is_removed = 0
  `).get(accountId, accountId, accountId, accountId);

  const account = db.prepare('SELECT opening_balance FROM accounts WHERE id = ?').get(accountId);

  const balance = account.opening_balance +
    result.total_income + result.total_transfer_in + result.total_loan_in -
    (result.total_expense + result.total_transfer_out + result.total_loan_out);

  db.prepare('UPDATE accounts SET current_balance = ?, updated_at = ? WHERE id = ?').run(balance, now(), accountId);
}
