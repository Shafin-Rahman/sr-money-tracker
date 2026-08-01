import { get, all, run } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export async function list(req, res) {
  const tags = await all(`SELECT t.*, (SELECT CAST(COUNT(*) AS INTEGER) FROM transaction_tags tt WHERE tt.tag_id = t.id) as usage_count FROM tags t ORDER BY t.name ASC`);
  res.json(tags);
}

export async function create(req, res) {
  const id = generateId();
  const timestamp = now();

  const { name, color } = req.body;

  const existing = await get('SELECT id FROM tags WHERE name = ?', name);
  if (existing) {
    return res.status(409).json({ error: 'Tag with this name already exists' });
  }

  await run('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)', id, name, color || '#6366f1', timestamp);

  const tag = await get('SELECT * FROM tags WHERE id = ?', id);
  res.status(201).json(tag);
}

export async function update(req, res) {
  const timestamp = now();

  const existing = await get('SELECT * FROM tags WHERE id = ?', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Tag not found' });
  }

  const { name, color } = req.body;

  await run('UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?', name || null, color || null, req.params.id);

  const tag = await get('SELECT * FROM tags WHERE id = ?', req.params.id);
  res.json(tag);
}

export async function remove(req, res) {
  const existing = await get('SELECT * FROM tags WHERE id = ?', req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Tag not found' });
  }

  await run('DELETE FROM transaction_tags WHERE tag_id = ?', req.params.id);
  await run('DELETE FROM tags WHERE id = ?', req.params.id);

  res.json({ message: 'Tag deleted successfully' });
}
