import { getSqlite } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export function list(req, res) {
  const db = getSqlite();
  const fields = db.prepare('SELECT * FROM custom_fields ORDER BY sort_order ASC, name ASC').all();
  res.json(fields);
}

export function create(req, res) {
  const db = getSqlite();
  const id = generateId();
  const timestamp = now();

  const { name, type, isRequired } = req.body;

  db.prepare(`INSERT INTO custom_fields (id, name, type, is_required, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM custom_fields), ?, ?)`).run(
    id, name, type || 'text', isRequired ? 1 : 0, timestamp, timestamp
  );

  const field = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(id);
  res.status(201).json(field);
}

export function update(req, res) {
  const db = getSqlite();
  const timestamp = now();
  const existing = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Custom field not found' });

  const { name, type, isRequired, sortOrder } = req.body;

  db.prepare(`UPDATE custom_fields SET
    name = COALESCE(?, name), type = COALESCE(?, type),
    is_required = COALESCE(?, is_required),
    sort_order = COALESCE(?, sort_order), updated_at = ? WHERE id = ?`).run(
    name || null, type || null,
    isRequired !== undefined ? (isRequired ? 1 : 0) : null,
    sortOrder || null, timestamp, req.params.id
  );

  const field = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(req.params.id);
  res.json(field);
}

export function remove(req, res) {
  const db = getSqlite();
  const existing = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Custom field not found' });
  db.prepare('DELETE FROM transaction_custom_fields WHERE field_id = ?').run(req.params.id);
  db.prepare('DELETE FROM custom_fields WHERE id = ?').run(req.params.id);
  res.json({ message: 'Custom field deleted' });
}

export function getTransactionValues(req, res) {
  const db = getSqlite();
  const values = db.prepare(`SELECT tcf.*, cf.name as field_name, cf.type as field_type
    FROM transaction_custom_fields tcf
    JOIN custom_fields cf ON tcf.field_id = cf.id
    WHERE tcf.transaction_id = ?`).all(req.params.transactionId);
  res.json(values);
}

export function setTransactionValues(req, res) {
  const db = getSqlite();
  const timestamp = now();

  db.prepare('DELETE FROM transaction_custom_fields WHERE transaction_id = ?').run(req.params.transactionId);

  const { fields } = req.body;
  if (fields && fields.length > 0) {
    const insert = db.prepare('INSERT INTO transaction_custom_fields (id, transaction_id, field_id, value, created_at) VALUES (?, ?, ?, ?, ?)');
    fields.forEach((f) => {
      insert.run(generateId(), req.params.transactionId, f.fieldId, f.value, timestamp);
    });
  }

  res.json({ message: 'Custom fields updated' });
}
