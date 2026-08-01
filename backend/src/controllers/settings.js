import { get, all, run } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export async function getAll(req, res) {
  const settingsList = await all('SELECT * FROM settings');
  const settings = {};
  settingsList.forEach((s) => {
    settings[s.key] = s.value;
  });
  res.json(settings);
}

export async function getByKey(req, res) {
  const setting = await get('SELECT * FROM settings WHERE key = ?', req.params.key);

  if (!setting) {
    return res.status(404).json({ error: 'Setting not found' });
  }

  res.json(setting);
}

export async function update(req, res) {
  const timestamp = now();

  const { key, value } = req.body;

  const existing = await get('SELECT * FROM settings WHERE key = ?', key);

  if (existing) {
    await run('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?', value, timestamp, key);
  } else {
    await run('INSERT INTO settings (id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', generateId(), key, value, timestamp, timestamp);
  }

  const setting = await get('SELECT * FROM settings WHERE key = ?', key);
  res.json(setting);
}
