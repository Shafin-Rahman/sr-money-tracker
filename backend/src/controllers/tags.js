import { getSqlite } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export function list(req, res) {
  const db = getSqlite();
  const tags = db.prepare('SELECT t.*, (SELECT COUNT(*) FROM transaction_tags tt WHERE tt.tag_id = t.id) as usage_count FROM tags t ORDER BY t.name ASC').all();
  res.json(tags);
}

export function create(req, res) {
  const db = getSqlite();
  const id = generateId();
  const timestamp = now();

  const { name, color } = req.body;

  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
  if (existing) {
    return res.status(409).json({ error: 'Tag with this name already exists' });
  }

  db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(id, name, color || '#6366f1', timestamp);

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  res.status(201).json(tag);
}

export function update(req, res) {
  const db = getSqlite();
  const timestamp = now();

  const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Tag not found' });
  }

  const { name, color } = req.body;

  db.prepare('UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?').run(name || null, color || null, req.params.id);

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  res.json(tag);
}

export function remove(req, res) {
  const db = getSqlite();
  const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Tag not found' });
  }

  db.prepare('DELETE FROM transaction_tags WHERE tag_id = ?').run(req.params.id);
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);

  res.json({ message: 'Tag deleted successfully' });
}
