import { getSqlite } from '../db/index.js';
import crypto from 'crypto';
import { now, generateId } from '../utils/helpers.js';

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin + 'sr-money-tracker-salt').digest('hex');
}

export function getStatus(req, res) {
  const db = getSqlite();
  let lock = db.prepare('SELECT * FROM app_lock LIMIT 1').get();

  if (!lock) {
    const id = generateId();
    const timestamp = now();
    db.prepare('INSERT INTO app_lock (id, is_enabled, auto_lock_minutes, last_unlocked_at, created_at, updated_at) VALUES (?, 0, 5, ?, ?, ?)').run(id, timestamp, timestamp, timestamp);
    lock = db.prepare('SELECT * FROM app_lock LIMIT 1').get();
  }

  res.json({
    isEnabled: !!lock.is_enabled,
    autoLockMinutes: lock.auto_lock_minutes,
    hasPin: !!lock.pin_hash,
    lastUnlockedAt: lock.last_unlocked_at,
  });
}

export function setupPin(req, res) {
  const db = getSqlite();
  const { pin } = req.body;

  if (!pin || pin.length < 4 || pin.length > 6) {
    return res.status(400).json({ error: 'PIN must be 4-6 digits' });
  }

  const timestamp = now();
  const pinHash = hashPin(pin);

  let lock = db.prepare('SELECT * FROM app_lock LIMIT 1').get();

  if (lock) {
    if (lock.pin_hash) {
      return res.status(400).json({ error: 'PIN already set. Use update endpoint.' });
    }
    db.prepare('UPDATE app_lock SET pin_hash = ?, is_enabled = 1, last_unlocked_at = ?, updated_at = ? WHERE id = ?').run(pinHash, timestamp, timestamp, lock.id);
  } else {
    const id = generateId();
    db.prepare('INSERT INTO app_lock (id, pin_hash, is_enabled, auto_lock_minutes, last_unlocked_at, created_at, updated_at) VALUES (?, ?, 1, 5, ?, ?, ?)').run(id, pinHash, timestamp, timestamp, timestamp);
  }

  res.json({ message: 'PIN set successfully', isEnabled: true });
}

export function updatePin(req, res) {
  const db = getSqlite();
  const { oldPin, newPin } = req.body;

  const lock = db.prepare('SELECT * FROM app_lock LIMIT 1').get();
  if (!lock || !lock.pin_hash) {
    return res.status(400).json({ error: 'No PIN set' });
  }

  if (hashPin(oldPin) !== lock.pin_hash) {
    return res.status(403).json({ error: 'Old PIN is incorrect' });
  }

  if (!newPin || newPin.length < 4 || newPin.length > 6) {
    return res.status(400).json({ error: 'New PIN must be 4-6 digits' });
  }

  db.prepare('UPDATE app_lock SET pin_hash = ?, updated_at = ? WHERE id = ?').run(hashPin(newPin), now(), lock.id);
  res.json({ message: 'PIN updated successfully' });
}

export function verifyPin(req, res) {
  const db = getSqlite();
  const { pin } = req.body;

  const lock = db.prepare('SELECT * FROM app_lock LIMIT 1').get();
  if (!lock || !lock.pin_hash) {
    return res.json({ verified: true, message: 'No PIN set' });
  }

  if (hashPin(pin) !== lock.pin_hash) {
    return res.status(403).json({ verified: false, error: 'Invalid PIN' });
  }

  const timestamp = now();
  db.prepare('UPDATE app_lock SET last_unlocked_at = ?, updated_at = ? WHERE id = ?').run(timestamp, timestamp, lock.id);

  res.json({ verified: true, message: 'PIN verified' });
}

export function disablePin(req, res) {
  const db = getSqlite();
  const { pin } = req.body;

  const lock = db.prepare('SELECT * FROM app_lock LIMIT 1').get();
  if (!lock || !lock.pin_hash) {
    return res.status(400).json({ error: 'No PIN set' });
  }

  if (hashPin(pin) !== lock.pin_hash) {
    return res.status(403).json({ error: 'PIN is incorrect' });
  }

  db.prepare('UPDATE app_lock SET pin_hash = NULL, is_enabled = 0, updated_at = ? WHERE id = ?').run(now(), lock.id);
  res.json({ message: 'PIN disabled', isEnabled: false });
}

export function updateAutoLock(req, res) {
  const db = getSqlite();
  const { minutes } = req.body;

  if (!minutes || minutes < 1) {
    return res.status(400).json({ error: 'Auto-lock time must be at least 1 minute' });
  }

  let lock = db.prepare('SELECT * FROM app_lock LIMIT 1').get();
  if (lock) {
    db.prepare('UPDATE app_lock SET auto_lock_minutes = ?, updated_at = ? WHERE id = ?').run(minutes, now(), lock.id);
  } else {
    const id = generateId();
    const timestamp = now();
    db.prepare('INSERT INTO app_lock (id, auto_lock_minutes, last_unlocked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, minutes, timestamp, timestamp, timestamp);
  }

  res.json({ message: 'Auto-lock updated', autoLockMinutes: minutes });
}
