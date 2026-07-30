import { getSqlite } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export function getAll(req, res) {
  const db = getSqlite();
  const settingsList = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  settingsList.forEach((s) => {
    settings[s.key] = s.value;
  });
  res.json(settings);
}

export function getByKey(req, res) {
  const db = getSqlite();
  const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);

  if (!setting) {
    return res.status(404).json({ error: 'Setting not found' });
  }

  res.json(setting);
}

export function update(req, res) {
  const db = getSqlite();
  const timestamp = now();

  const { key, value } = req.body;

  const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);

  if (existing) {
    db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').run(value, timestamp, key);
  } else {
    db.prepare('INSERT INTO settings (id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(generateId(), key, value, timestamp, timestamp);
  }

  const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
  res.json(setting);
}
