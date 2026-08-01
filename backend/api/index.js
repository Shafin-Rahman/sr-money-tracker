import app from '../src/app.js';
import { ensureDatabase } from '../src/db/init.js';

export default async function handler(req, res) {
  try {
    await ensureDatabase();
  } catch (err) {
    res.status(500).json({ error: 'Database initialization failed', message: err.message });
    return;
  }
  return app(req, res);
}
