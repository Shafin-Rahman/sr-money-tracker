import { getSqlite } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export function list(req, res) {
  const db = getSqlite();
  const type = req.query.type;
  const includeArchived = req.query.include_archived === 'true';

  let query = 'SELECT * FROM categories WHERE 1=1';
  const params = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  if (!includeArchived) {
    query += ' AND is_archived = 0';
  }

  query += ' ORDER BY sort_order ASC, name ASC';

  const categories = db.prepare(query).all(...params);

  const tree = buildCategoryTree(categories);

  res.json({ categories, tree });
}

function buildCategoryTree(categories) {
  const map = {};
  const roots = [];

  categories.forEach((cat) => {
    map[cat.id] = { ...cat, children: [] };
  });

  categories.forEach((cat) => {
    if (cat.parent_id && map[cat.parent_id]) {
      map[cat.parent_id].children.push(map[cat.id]);
    } else if (!cat.parent_id) {
      roots.push(map[cat.id]);
    }
  });

  return roots;
}

export function getById(req, res) {
  const db = getSqlite();
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);

  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const children = db.prepare('SELECT * FROM categories WHERE parent_id = ? ORDER BY sort_order ASC').all(req.params.id);
  category.children = children;

  res.json(category);
}

export function create(req, res) {
  const db = getSqlite();
  const id = generateId();
  const timestamp = now();

  const { name, type, parentId, icon, color, sortOrder } = req.body;

  if (parentId) {
    const parent = db.prepare('SELECT * FROM categories WHERE id = ?').get(parentId);
    if (!parent) {
      return res.status(404).json({ error: 'Parent category not found' });
    }
  }

  db.prepare(`INSERT INTO categories (id, name, type, parent_id, icon, color, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, name, type, parentId || null, icon || 'circle', color || '#6366f1',
    sortOrder || 0, timestamp, timestamp
  );

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.status(201).json(category);
}

export function update(req, res) {
  const db = getSqlite();
  const timestamp = now();

  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const { name, type, icon, color, isActive, isArchived, sortOrder, parentId } = req.body;

  db.prepare(`UPDATE categories SET
    name = COALESCE(?, name),
    type = COALESCE(?, type),
    icon = COALESCE(?, icon),
    color = COALESCE(?, color),
    parent_id = ?,
    is_active = COALESCE(?, is_active),
    is_archived = COALESCE(?, is_archived),
    sort_order = COALESCE(?, sort_order),
    updated_at = ?
    WHERE id = ?`).run(
    name || null, type || null, icon || null, color || null,
    parentId !== undefined ? parentId : existing.parent_id,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    isArchived !== undefined ? (isArchived ? 1 : 0) : null,
    sortOrder || null, timestamp, req.params.id
  );

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json(category);
}

export function remove(req, res) {
  const db = getSqlite();
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const children = db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').get(req.params.id);
  if (children.count > 0) {
    return res.status(400).json({ error: 'Cannot delete category with subcategories. Remove or reassign them first.' });
  }

  db.prepare('UPDATE transactions SET category_id = NULL WHERE category_id = ?').run(req.params.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);

  res.json({ message: 'Category deleted successfully' });
}

export function merge(req, res) {
  const db = getSqlite();
  const timestamp = now();

  const { sourceId, targetId } = req.body;

  const source = db.prepare('SELECT * FROM categories WHERE id = ?').get(sourceId);
  const target = db.prepare('SELECT * FROM categories WHERE id = ?').get(targetId);

  if (!source || !target) {
    return res.status(404).json({ error: 'Source or target category not found' });
  }

  db.prepare('UPDATE transactions SET category_id = ? WHERE category_id = ?').run(targetId, sourceId);
  db.prepare('UPDATE budgets SET category_id = ? WHERE category_id = ?').run(targetId, sourceId);
  db.prepare('DELETE FROM categories WHERE id = ?').run(sourceId);

  res.json({ message: 'Categories merged successfully', target });
}
