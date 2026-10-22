const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const backendRoot = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const { DEFAULT_CATEGORIES } = require('../utils/defaultCategories');

// Derive database path relative to backend root. Support db.sqlite3 as requested.
let configuredPath = process.env.DB_PATH || './db.sqlite3';
let dbPath = path.resolve(backendRoot, configuredPath);

// Only copy default db if DB_PATH was not explicitly set (e.g. not in unit tests)
if (!fs.existsSync(dbPath) && !process.env.DB_PATH && fs.existsSync(path.join(backendRoot, 'database', 'db.sqlite3'))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.copyFileSync(path.join(backendRoot, 'database', 'db.sqlite3'), dbPath);
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// 1. Create tables first (without indexes)
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  sid            TEXT PRIMARY KEY,
  sess           TEXT NOT NULL,
  expired        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id        INTEGER PRIMARY KEY,
  display_name   TEXT,
  page_size      INTEGER DEFAULT 10,
  theme          TEXT DEFAULT 'light',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER,
  name           TEXT NOT NULL,
  color          TEXT,
  icon           TEXT,
  monthly_budget REAL DEFAULT 0,
  created_at     TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expenses (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER,
  title          TEXT NOT NULL,
  amount         REAL NOT NULL CHECK(amount > 0),
  category_id    INTEGER NOT NULL,
  expense_date   TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  notes          TEXT DEFAULT '',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT
);
`);

// 2. Migration check: ensure user_id column exists on legacy tables
const categoryCols = db.prepare('PRAGMA table_info(categories)').all().map((c) => c.name);
if (!categoryCols.includes('user_id')) {
  db.exec('ALTER TABLE categories ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
}

const expenseCols = db.prepare('PRAGMA table_info(expenses)').all().map((c) => c.name);
if (!expenseCols.includes('user_id')) {
  db.exec('ALTER TABLE expenses ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
}

// Check if categories still has a legacy global UNIQUE(name) constraint and migrate it to UNIQUE(user_id, name)
const indexes = db.prepare('PRAGMA index_list(categories)').all();
const hasGlobalNameUnique = indexes.some((idx) => {
  if (!idx.unique) return false;
  const cols = db.prepare(`PRAGMA index_info('${idx.name}')`).all();
  return cols.length === 1 && cols[0].name === 'name';
});

if (hasGlobalNameUnique) {
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE categories_new (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER,
        name           TEXT NOT NULL,
        color          TEXT,
        icon           TEXT,
        monthly_budget REAL DEFAULT 0,
        created_at     TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, name)
      );
      INSERT INTO categories_new (id, user_id, name, color, icon, monthly_budget, created_at)
        SELECT id, user_id, name, color, icon, monthly_budget, created_at FROM categories;
      DROP TABLE categories;
      ALTER TABLE categories_new RENAME TO categories;
    `);
  })();
  db.pragma('foreign_keys = ON');
}

// 3. Now create indexes safely
db.exec(`
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_expired   ON sessions(expired);
CREATE INDEX IF NOT EXISTS idx_categories_user    ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_cat  ON expenses(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_cat_date  ON expenses(user_id, category_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date      ON expenses(expense_date);
`);

// 4. Migrate any legacy unassigned rows to demo user
const unassignedExpenses = db.prepare('SELECT COUNT(*) AS n FROM expenses WHERE user_id IS NULL').get().n;
const unassignedCategories = db.prepare('SELECT COUNT(*) AS n FROM categories WHERE user_id IS NULL').get().n;

if (unassignedExpenses > 0 || unassignedCategories > 0) {
  const now = new Date().toISOString();
  let demoUser = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@expensewise.local');
  if (!demoUser) {
    const passwordHash = bcrypt.hashSync('Demo@123', 10);
    const info = db.prepare(
      'INSERT INTO users (name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run('Demo User', 'demo@expensewise.local', passwordHash, now, now);
    demoUser = { id: info.lastInsertRowid };

    db.prepare(
      'INSERT OR IGNORE INTO user_settings (user_id, display_name, page_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(demoUser.id, 'Demo User', 10, now, now);
  }

  db.transaction(() => {
    db.prepare('UPDATE categories SET user_id = ? WHERE user_id IS NULL').run(demoUser.id);
    db.prepare('UPDATE expenses SET user_id = ? WHERE user_id IS NULL').run(demoUser.id);
  })();
}

/**
 * Seed 12 default categories for a specific user ID.
 */
function seedUserCategories(userId) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM categories WHERE user_id = ?').get(userId).n;
  if (count === 0) {
    const insert = db.prepare(
      'INSERT INTO categories (user_id, name, color, icon, monthly_budget, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const now = new Date().toISOString();
    db.transaction(() => {
      DEFAULT_CATEGORIES.forEach((c) => insert.run(userId, c.name, c.color, c.icon, c.monthly_budget, now));
    })();
  }
}

module.exports = db;
module.exports.dbPath = dbPath;
module.exports.seedUserCategories = seedUserCategories;
