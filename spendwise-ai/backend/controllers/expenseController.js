const db = require('../database/database');
const AppError = require('../utils/AppError');
const { round2 } = require('../utils/dateUtils');

const SELECT_EXPENSE = `
  SELECT e.id, e.user_id, e.title, e.amount, e.category_id, e.expense_date, e.payment_method, e.notes,
         e.created_at, e.updated_at,
         c.name AS category_name, c.color AS category_color, c.icon AS category_icon
  FROM expenses e JOIN categories c ON c.id = e.category_id`;

// Builds a parameterized WHERE clause from query-string filters, scoped to the user.
function buildFilters(q, userId) {
  const where = ['e.user_id = ?'];
  const params = [userId];

  if (q.search) {
    const like = `%${String(q.search).replace(/[\\%_]/g, '\\$&')}%`;
    where.push("(e.title LIKE ? ESCAPE '\\' OR e.notes LIKE ? ESCAPE '\\')");
    params.push(like, like);
  }
  if (q.category) {
    where.push('e.category_id = ?');
    params.push(Number(q.category));
  }
  if (q.payment_method) {
    where.push('e.payment_method = ?');
    params.push(q.payment_method);
  }
  if (q.start_date) {
    where.push('e.expense_date >= ?');
    params.push(q.start_date);
  }
  if (q.end_date) {
    where.push('e.expense_date <= ?');
    params.push(q.end_date);
  }
  return { clause: `WHERE ${where.join(' AND ')}`, params };
}

function list(req, res) {
  const userId = req.user.id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const { clause, params } = buildFilters(req.query, userId);

  const summary = db
    .prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(e.amount), 0) AS total FROM expenses e ${clause}`)
    .get(...params);
  const items = db
    .prepare(`${SELECT_EXPENSE} ${clause} ORDER BY e.expense_date DESC, e.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);

  res.json({
    success: true,
    data: items,
    summary: { count: summary.count, total_amount: round2(summary.total) },
    pagination: {
      page,
      limit,
      total: summary.count,
      total_pages: Math.max(1, Math.ceil(summary.count / limit)),
    },
  });
}

function getOne(req, res) {
  const userId = req.user.id;
  const row = db.prepare(`${SELECT_EXPENSE} WHERE e.id = ? AND e.user_id = ?`).get(Number(req.params.id), userId);
  if (!row) throw new AppError('Expense not found', 404);
  res.json({ success: true, data: row });
}

function assertCategoryExists(categoryId, userId) {
  const cat = db.prepare('SELECT 1 FROM categories WHERE id = ? AND user_id = ?').get(categoryId, userId);
  if (!cat) {
    throw new AppError('Selected category does not exist or does not belong to your account', 400);
  }
}

function create(req, res) {
  const userId = req.user.id;
  const b = req.body;
  assertCategoryExists(b.category_id, userId);

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO expenses (user_id, title, amount, category_id, expense_date, payment_method, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, b.title.trim(), round2(b.amount), b.category_id, b.expense_date, b.payment_method, (b.notes || '').trim(), now, now);

  const row = db.prepare(`${SELECT_EXPENSE} WHERE e.id = ? AND e.user_id = ?`).get(info.lastInsertRowid, userId);
  res.status(201).json({ success: true, message: 'Expense added successfully', data: row });
}

function update(req, res) {
  const userId = req.user.id;
  const id = Number(req.params.id);
  const b = req.body;

  const existing = db.prepare('SELECT 1 FROM expenses WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) throw new AppError('Expense not found', 404);

  assertCategoryExists(b.category_id, userId);

  db.prepare(
    `UPDATE expenses SET title = ?, amount = ?, category_id = ?, expense_date = ?, payment_method = ?,
            notes = ?, updated_at = ? WHERE id = ? AND user_id = ?`
  ).run(b.title.trim(), round2(b.amount), b.category_id, b.expense_date, b.payment_method, (b.notes || '').trim(), new Date().toISOString(), id, userId);

  const row = db.prepare(`${SELECT_EXPENSE} WHERE e.id = ? AND e.user_id = ?`).get(id, userId);
  res.json({ success: true, message: 'Expense updated successfully', data: row });
}

function remove(req, res) {
  const userId = req.user.id;
  const info = db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(Number(req.params.id), userId);
  if (info.changes === 0) throw new AppError('Expense not found', 404);
  res.json({ success: true, message: 'Expense deleted successfully' });
}

/**
 * Truncate expenses table.
 * Supports scope: 'user' (current user only) or 'all' (entire expenses table).
 */
function truncateExpenses(req, res) {
  const userId = req.user.id;
  const scope = req.body?.scope === 'all' || req.query?.scope === 'all' ? 'all' : 'user';

  let deletedCount = 0;
  db.transaction(() => {
    if (scope === 'all') {
      const countRow = db.prepare('SELECT COUNT(*) AS count FROM expenses').get();
      deletedCount = countRow ? countRow.count : 0;
      db.prepare('DELETE FROM expenses').run();
      try {
        db.prepare("DELETE FROM sqlite_sequence WHERE name = 'expenses'").run();
      } catch (_) {}
    } else {
      const countRow = db.prepare('SELECT COUNT(*) AS count FROM expenses WHERE user_id = ?').get(userId);
      deletedCount = countRow ? countRow.count : 0;
      db.prepare('DELETE FROM expenses WHERE user_id = ?').run(userId);
      const totalRemaining = db.prepare('SELECT COUNT(*) AS count FROM expenses').get().count;
      if (totalRemaining === 0) {
        try {
          db.prepare("DELETE FROM sqlite_sequence WHERE name = 'expenses'").run();
        } catch (_) {}
      }
    }
  })();

  try {
    db.pragma('vacuum');
  } catch (_) {}

  const totalRemaining = db.prepare('SELECT COUNT(*) AS count FROM expenses').get().count;

  res.json({
    success: true,
    message:
      scope === 'all'
        ? `Expenses table truncated successfully (${deletedCount} records deleted).`
        : `All your expenses have been truncated (${deletedCount} records deleted).`,
    data: {
      deletedCount,
      scope,
      totalRemaining,
    },
  });
}

/**
 * Reset tables: clears expenses and restores the 12 default categories.
 */
function resetTables(req, res) {
  const userId = req.user.id;
  const scope = req.body?.scope === 'all' || req.query?.scope === 'all' ? 'all' : 'user';

  let deletedExpenses = 0;
  let deletedCategories = 0;

  db.transaction(() => {
    if (scope === 'all') {
      deletedExpenses = db.prepare('SELECT COUNT(*) AS count FROM expenses').get().count;
      db.prepare('DELETE FROM expenses').run();
      try {
        db.prepare("DELETE FROM sqlite_sequence WHERE name = 'expenses'").run();
      } catch (_) {}

      deletedCategories = db.prepare('SELECT COUNT(*) AS count FROM categories').get().count;
      db.prepare('DELETE FROM categories').run();
      try {
        db.prepare("DELETE FROM sqlite_sequence WHERE name = 'categories'").run();
      } catch (_) {}

      const users = db.prepare('SELECT id FROM users').all();
      users.forEach((u) => {
        db.seedUserCategories(u.id);
      });
    } else {
      deletedExpenses = db.prepare('SELECT COUNT(*) AS count FROM expenses WHERE user_id = ?').get(userId).count;
      db.prepare('DELETE FROM expenses WHERE user_id = ?').run(userId);

      deletedCategories = db.prepare('SELECT COUNT(*) AS count FROM categories WHERE user_id = ?').get(userId).count;
      db.prepare('DELETE FROM categories WHERE user_id = ?').run(userId);

      db.seedUserCategories(userId);
    }
  })();

  try {
    db.pragma('vacuum');
  } catch (_) {}

  res.json({
    success: true,
    message:
      scope === 'all'
        ? `All tables reset: cleared ${deletedExpenses} expenses and re-initialized default categories.`
        : `Account tables reset: cleared ${deletedExpenses} expenses and restored 12 default categories.`,
    data: {
      deletedExpenses,
      deletedCategories,
      scope,
    },
  });
}

// Quote a CSV cell; neutralise spreadsheet formulas (=, +, -, @) in user text.
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV export of every record matching the current filters (no pagination), scoped to user.
function exportCsv(req, res) {
  const userId = req.user.id;
  const { clause, params } = buildFilters(req.query, userId);
  const rows = db.prepare(`${SELECT_EXPENSE} ${clause} ORDER BY e.expense_date DESC, e.id DESC`).all(...params);
  const header = ['ID', 'Date', 'Title', 'Category', 'Amount (INR)', 'Payment Method', 'Notes'];
  const lines = [header.join(',')].concat(
    rows.map((r) =>
      [r.id, r.expense_date, r.title, r.category_name, r.amount.toFixed(2), r.payment_method, r.notes].map(csvCell).join(',')
    )
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="personal-expenses.csv"');
  res.send('\ufeff' + lines.join('\r\n')); // BOM so Excel reads UTF-8 correctly
}

module.exports = { list, getOne, create, update, remove, truncateExpenses, resetTables, exportCsv };
