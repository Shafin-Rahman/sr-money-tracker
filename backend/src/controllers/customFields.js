import { get, all, run } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export async function list(req, res) {
  const fields = await all('SELECT * FROM custom_fields ORDER BY sort_order ASC, name ASC');
  res.json(fields);
}

export async function create(req, res) {
  const id = generateId();
  const timestamp = now();

  const { name, type, isRequired } = req.body;

  await run(`INSERT INTO custom_fields (id, name, type, is_required, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM custom_fields), ?, ?)`,
    id, name, type || 'text', isRequired ? 1 : 0, timestamp, timestamp
  );

  const field = await get('SELECT * FROM custom_fields WHERE id = ?', id);
  res.status(201).json(field);
}

export async function update(req, res) {
  const timestamp = now();
  const existing = await get('SELECT * FROM custom_fields WHERE id = ?', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Custom field not found' });

  const { name, type, isRequired, sortOrder } = req.body;

  await run(`UPDATE custom_fields SET
    name = COALESCE(?, name), type = COALESCE(?, type),
    is_required = COALESCE(?, is_required),
    sort_order = COALESCE(?, sort_order), updated_at = ? WHERE id = ?`,
    name || null, type || null,
    isRequired !== undefined ? (isRequired ? 1 : 0) : null,
    sortOrder || null, timestamp, req.params.id
  );

  const field = await get('SELECT * FROM custom_fields WHERE id = ?', req.params.id);
  res.json(field);
}

export async function remove(req, res) {
  const existing = await get('SELECT * FROM custom_fields WHERE id = ?', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Custom field not found' });
  await run('DELETE FROM transaction_custom_fields WHERE field_id = ?', req.params.id);
  await run('DELETE FROM custom_fields WHERE id = ?', req.params.id);
  res.json({ message: 'Custom field deleted' });
}

export async function getTransactionValues(req, res) {
  const values = await all(`SELECT tcf.*, cf.name as field_name, cf.type as field_type
    FROM transaction_custom_fields tcf
    JOIN custom_fields cf ON tcf.field_id = cf.id
    WHERE tcf.transaction_id = ?`, req.params.transactionId);
  res.json(values);
}

export async function setTransactionValues(req, res) {
  const timestamp = now();

  await run('DELETE FROM transaction_custom_fields WHERE transaction_id = ?', req.params.transactionId);

  const { fields } = req.body;
  if (fields && fields.length > 0) {
    for (const f of fields) {
      await run('INSERT INTO transaction_custom_fields (id, transaction_id, field_id, value, created_at) VALUES (?, ?, ?, ?, ?)',
        generateId(), req.params.transactionId, f.fieldId, f.value, timestamp);
    }
  }

  res.json({ message: 'Custom fields updated' });
}
