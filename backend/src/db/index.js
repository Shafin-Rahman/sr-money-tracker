import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import config from '../config.js';
import * as schema from './schema.js';

let db;

export function getDatabase() {
  if (db) return db;

  const sqlite = new Database(config.databaseUrl.replace('file:', ''));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  db = drizzle(sqlite, { schema });
  return db;
}

export function getSqlite() {
  const db = getDatabase();
  return db.session.client;
}
