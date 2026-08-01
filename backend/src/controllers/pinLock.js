import { get, run } from '../db/index.js';
import crypto from 'crypto';
import { now } from '../utils/helpers.js';

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin + 'sr-money-tracker-salt').digest('hex');
}

export async function getStatus(req, res) {
  let lock = await get('SELECT * FROM app_lock ORDER BY id LIMIT 1');

  if (!lock) {
    const id = 'app-lock';
    const timestamp = now();
    await run('INSERT INTO app_lock (id, is_enabled, auto_lock_minutes, last_unlocked_at, created_at, updated_at) VALUES (?, 0, 5, ?, ?, ?)', id, timestamp, timestamp, timestamp);
    lock = await get('SELECT * FROM app_lock LIMIT 1');
  }

  res.json({
    isEnabled: !!lock.is_enabled,
    autoLockMinutes: lock.auto_lock_minutes,
    hasPin: !!lock.pin_hash,
    lastUnlockedAt: lock.last_unlocked_at,
    pinHash: lock.pin_hash || null,
  });
}

export async function setupPin(req, res) {
  const { pin } = req.body;

  if (!pin || pin.length < 4 || pin.length > 6) {
    return res.status(400).json({ error: 'PIN must be 4-6 digits' });
  }

  const timestamp = now();
  const pinHash = hashPin(pin);

  let lock = await get('SELECT * FROM app_lock ORDER BY id LIMIT 1');

  if (lock) {
    if (lock.pin_hash) {
      return res.status(400).json({ error: 'PIN already set. Use update endpoint.' });
    }
    await run('UPDATE app_lock SET pin_hash = ?, is_enabled = 1, last_unlocked_at = ?, updated_at = ? WHERE id = ?', pinHash, timestamp, timestamp, lock.id);
  } else {
    const id = 'app-lock';
    await run('INSERT INTO app_lock (id, pin_hash, is_enabled, auto_lock_minutes, last_unlocked_at, created_at, updated_at) VALUES (?, ?, 1, 5, ?, ?, ?)', id, pinHash, timestamp, timestamp, timestamp);
  }

  res.json({ message: 'PIN set successfully', isEnabled: true });
}

export async function updatePin(req, res) {
  const { oldPin, newPin } = req.body;

  const lock = await get('SELECT * FROM app_lock LIMIT 1');
  if (!lock || !lock.pin_hash) {
    return res.status(400).json({ error: 'No PIN set' });
  }

  if (hashPin(oldPin) !== lock.pin_hash) {
    return res.status(403).json({ error: 'Old PIN is incorrect' });
  }

  if (!newPin || newPin.length < 4 || newPin.length > 6) {
    return res.status(400).json({ error: 'New PIN must be 4-6 digits' });
  }

  await run('UPDATE app_lock SET pin_hash = ?, updated_at = ? WHERE id = ?', hashPin(newPin), now(), lock.id);
  res.json({ message: 'PIN updated successfully' });
}

export async function verifyPin(req, res) {
  const { pin } = req.body;

  const lock = await get('SELECT * FROM app_lock LIMIT 1');
  if (!lock || !lock.pin_hash) {
    return res.json({ verified: true, message: 'No PIN set' });
  }

  if (hashPin(pin) !== lock.pin_hash) {
    return res.status(403).json({ verified: false, error: 'Invalid PIN' });
  }

  const timestamp = now();
  await run('UPDATE app_lock SET last_unlocked_at = ?, updated_at = ? WHERE id = ?', timestamp, timestamp, lock.id);

  res.json({ verified: true, message: 'PIN verified' });
}

export async function disablePin(req, res) {
  const { pin } = req.body;

  const lock = await get('SELECT * FROM app_lock LIMIT 1');
  if (!lock || !lock.pin_hash) {
    return res.status(400).json({ error: 'No PIN set' });
  }

  if (hashPin(pin) !== lock.pin_hash) {
    return res.status(403).json({ error: 'PIN is incorrect' });
  }

  await run('UPDATE app_lock SET pin_hash = NULL, is_enabled = 0, updated_at = ? WHERE id = ?', now(), lock.id);
  res.json({ message: 'PIN disabled', isEnabled: false });
}

export async function updateAutoLock(req, res) {
  const { minutes } = req.body;

  if (!minutes || minutes < 1) {
    return res.status(400).json({ error: 'Auto-lock time must be at least 1 minute' });
  }

  let lock = await get('SELECT * FROM app_lock ORDER BY id LIMIT 1');
  if (lock) {
    await run('UPDATE app_lock SET auto_lock_minutes = ?, updated_at = ? WHERE id = ?', minutes, now(), lock.id);
  } else {
    const id = 'app-lock';
    const timestamp = now();
    await run('INSERT INTO app_lock (id, auto_lock_minutes, last_unlocked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', id, minutes, timestamp, timestamp, timestamp);
  }

  res.json({ message: 'Auto-lock updated', autoLockMinutes: minutes });
}
