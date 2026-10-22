-- Personal Expense Analysis and Prediction System schema.
-- Idempotent schema definition with full multi-user isolation and foreign-key constraints.

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
  expense_date   TEXT NOT NULL,           -- ISO date: YYYY-MM-DD
  payment_method TEXT NOT NULL,
  notes          TEXT DEFAULT '',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_expired   ON sessions(expired);
CREATE INDEX IF NOT EXISTS idx_categories_user    ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_cat  ON expenses(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_cat_date  ON expenses(user_id, category_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date      ON expenses(expense_date);
