import sqlite3pkg from 'sqlite3';
import { open } from 'sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const { Database } = sqlite3pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = join(__dirname, '../data/nutriplus.db');

mkdirSync(join(__dirname, '../data'), { recursive: true });

// Singleton da conexão
let _db;
export async function getDB() {
  if (!_db) {
    _db = await open({ filename: DB_PATH, driver: Database });
    await _db.run('PRAGMA journal_mode = WAL');
  }
  return _db;
}

export async function initDB() {
  const db = await getDB();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      email        TEXT    NOT NULL UNIQUE,
      password     TEXT,
      provider     TEXT    NOT NULL DEFAULT 'email',
      google_id    TEXT    UNIQUE,
      picture      TEXT,
      account_type TEXT    NOT NULL DEFAULT 'pro',
      active       INTEGER NOT NULL DEFAULT 1,
      crn          TEXT,
      specialty    TEXT,
      institution  TEXT,
      grade        TEXT,
      edu_level    TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Migrações para bancos já existentes
  const migrations = [
    'ALTER TABLE users ADD COLUMN active      INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE users ADD COLUMN crn         TEXT',
    'ALTER TABLE users ADD COLUMN specialty   TEXT',
    'ALTER TABLE users ADD COLUMN institution TEXT',
    'ALTER TABLE users ADD COLUMN grade       TEXT',
    'ALTER TABLE users ADD COLUMN edu_level   TEXT',
  ];
  for (const sql of migrations) {
    try { await db.run(sql); } catch { /* coluna já existe */ }
  }
}
