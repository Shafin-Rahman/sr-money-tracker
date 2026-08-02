import { get, all, run } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';
import { recomputeAccountBalance } from '../utils/balances.js';

export async function list(req, res) {
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

  const countQuery = `SELECT CAST(COUNT(*) AS INTEGER) as total FROM transactions t WHERE t.is_removed = 0` +
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
  const total = await get(countQuery, ...countParams);

  query += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const transactions = await all(query, ...params);

  const tagsQuery = `SELECT tt.transaction_id, tg.id, tg.name, tg.color
    FROM transaction_tags tt
    JOIN tags tg ON tt.tag_id = tg.id
    WHERE tt.transaction_id IN (${transactions.map(() => '?').join(',')})`;

  if (transactions.length > 0) {
    const tags = await all(tagsQuery, ...transactions.map((t) => t.id));
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

export async function getById(req, res) {
  const transaction = await get(`SELECT t.*, a.name as account_name, a.icon as account_icon, a.color as account_color,
    ta.name as to_account_name,
    c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN accounts ta ON t.to_account_id = ta.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?`, req.params.id);

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  transaction.tags = await all(`SELECT tg.* FROM transaction_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE tt.transaction_id = ?`, req.params.id);

  res.json(transaction);
}

export async function create(req, res) {
  const id = generateId();
  const timestamp = now();

  const { type, amount, accountId, toAccountId, categoryId, description,
    personName, personPhone, location, notes, date, time, tags: tagIds } = req.body;

  if (amount < 0) {
    return res.status(400).json({ error: 'Amount cannot be negative' });
  }

  if (type === 'transfer') {
    if (!toAccountId) {
      return res.status(400).json({ error: 'Transfer requires a destination account' });
    }
    if (toAccountId === accountId) {
      return res.status(400).json({ error: 'Source and destination account must be different' });
    }
  }

  const account = await get('SELECT * FROM accounts WHERE id = ?', accountId);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  await run(`INSERT INTO transactions (id, type, amount, account_id, to_account_id, category_id,
    description, person_name, person_phone, location, notes, date, time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, type, amount, accountId, toAccountId || null, categoryId || null,
    description || null, personName || null, personPhone || null,
    location || null, notes || null, date, time || null, timestamp, timestamp
  );

  await updateAccountBalance(accountId);

  if (toAccountId) {
    await updateAccountBalance(toAccountId);
  }

  if (tagIds && tagIds.length > 0) {
    for (const tagId of tagIds) {
      await run('INSERT INTO transaction_tags (id, transaction_id, tag_id) VALUES (?, ?, ?)', generateId(), id, tagId);
    }
  }

  const transaction = await get(`SELECT t.*, a.name as account_name,
    c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?`, id);

  res.status(201).json(transaction);
}

export async function update(req, res) {
  const timestamp = now();

  const existing = await get('SELECT * FROM transactions WHERE id = ?', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const { type, amount, accountId, toAccountId, categoryId, description,
    personName, personPhone, location, notes, date, time, tags: tagIds, isRemoved } = req.body;

  if (amount !== undefined && amount !== null && Number(amount) < 0) {
    return res.status(400).json({ error: 'Amount cannot be negative' });
  }
  const finalType = type || existing.type;
  const finalFrom = accountId || existing.account_id;
  const finalTo = toAccountId !== undefined ? toAccountId : existing.to_account_id;
  if (finalType === 'transfer') {
    if (!finalTo) {
      return res.status(400).json({ error: 'Transfer requires a destination account' });
    }
    if (finalTo === finalFrom) {
      return res.status(400).json({ error: 'Source and destination account must be different' });
    }
  }

  await run(`UPDATE transactions SET
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
    WHERE id = ?`,
    type || null, amount || null, accountId || null,
    toAccountId !== undefined ? toAccountId : existing.to_account_id,
    categoryId !== undefined ? categoryId : existing.category_id,
    description || null, personName || null, personPhone || null,
    location || null, notes || null, date || null, time || null,
    isRemoved !== undefined ? (isRemoved ? 1 : 0) : null,
    timestamp, req.params.id
  );

  if (tagIds !== undefined) {
    await run('DELETE FROM transaction_tags WHERE transaction_id = ?', req.params.id);
    for (const tagId of tagIds) {
      await run('INSERT INTO transaction_tags (id, transaction_id, tag_id) VALUES (?, ?, ?)', generateId(), req.params.id, tagId);
    }
  }

  const oldFrom = existing.account_id;
  const newFrom = accountId || existing.account_id;
  const oldTo = existing.to_account_id;
  const newTo = toAccountId !== undefined ? toAccountId : existing.to_account_id;

  const affected = new Set([oldFrom, newFrom, oldTo, newTo].filter(Boolean));
  for (const id of affected) {
    await updateAccountBalance(id);
  }

  const transaction = await get(`SELECT t.*, a.name as account_name,
    c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?`, req.params.id);

  res.json(transaction);
}

export async function remove(req, res) {
  const existing = await get('SELECT * FROM transactions WHERE id = ?', req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  await run('UPDATE transactions SET is_removed = 1, updated_at = ? WHERE id = ?', now(), req.params.id);
  const affected = [existing.account_id, existing.to_account_id].filter(Boolean);
  for (const id of affected) {
    await updateAccountBalance(id);
  }

  res.json({ message: 'Transaction removed successfully' });
}

export async function duplicate(req, res) {
  const existing = await get('SELECT * FROM transactions WHERE id = ?', req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const newId = generateId();
  const timestamp = now();

  await run(`INSERT INTO transactions (id, type, amount, account_id, to_account_id, category_id,
    description, person_name, person_phone, location, notes, date, time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId, existing.type, existing.amount, existing.account_id, existing.to_account_id,
    existing.category_id, existing.description, existing.person_name, existing.person_phone,
    existing.location, existing.notes, existing.date, existing.time, timestamp, timestamp
  );

  const oldTags = await all('SELECT tag_id FROM transaction_tags WHERE transaction_id = ?', req.params.id);
  for (const t of oldTags) {
    await run('INSERT INTO transaction_tags (id, transaction_id, tag_id) VALUES (?, ?, ?)', generateId(), newId, t.tag_id);
  }

  const affected = [existing.account_id, existing.to_account_id].filter(Boolean);
  for (const id of affected) {
    await updateAccountBalance(id);
  }

  const transaction = await get('SELECT * FROM transactions WHERE id = ?', newId);
  res.status(201).json(transaction);
}

async function updateAccountBalance(accountId) {
  await recomputeAccountBalance(accountId);
}
