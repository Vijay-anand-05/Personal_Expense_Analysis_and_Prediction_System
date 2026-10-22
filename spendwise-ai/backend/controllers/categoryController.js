const db = require('../database/database');
const AppError = require('../utils/AppError');
const { round2 } = require('../utils/dateUtils');

const SELECT_CATEGORY = `
  SELECT c.id, c.user_id, c.name, c.color, c.icon, c.monthly_budget, c.created_at,
         (SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id AND e.user_id = c.user_id) AS expense_count
  FROM categories c`;

function nameTaken(name, userId, exceptId = 0) {
  return db
    .prepare('SELECT 1 FROM categories WHERE LOWER(name) = LOWER(?) AND user_id = ? AND id != ?')
    .get(name.trim(), userId, exceptId);
}

function list(req, res) {
  const userId = req.user.id;
  const rows = db.prepare(`${SELECT_CATEGORY} WHERE c.user_id = ? ORDER BY c.name`).all(userId);
  res.json({ success: true, data: rows });
}

function create(req, res) {
  const userId = req.user.id;
  const b = req.body;
  if (nameTaken(b.name, userId)) {
    throw new AppError('A category with this name already exists in your account', 409);
  }

  const info = db
    .prepare('INSERT INTO categories (user_id, name, color, icon, monthly_budget, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, b.name.trim(), b.color || '#9AA59C', b.icon || 'tag', round2(b.monthly_budget || 0), new Date().toISOString());

  const row = db.prepare(`${SELECT_CATEGORY} WHERE c.id = ? AND c.user_id = ?`).get(info.lastInsertRowid, userId);
  res.status(201).json({ success: true, message: 'Category created', data: row });
}

function update(req, res) {
  const userId = req.user.id;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) throw new AppError('Category not found', 404);

  const b = req.body;
  if (nameTaken(b.name, userId, id)) {
    throw new AppError('A category with this name already exists in your account', 409);
  }

  db.prepare(
    'UPDATE categories SET name = ?, color = ?, icon = ?, monthly_budget = ? WHERE id = ? AND user_id = ?'
  ).run(
    b.name.trim(),
    b.color || existing.color,
    b.icon || existing.icon,
    b.monthly_budget === undefined ? existing.monthly_budget : round2(b.monthly_budget),
    id,
    userId
  );

  const row = db.prepare(`${SELECT_CATEGORY} WHERE c.id = ? AND c.user_id = ?`).get(id, userId);
  res.json({ success: true, message: 'Category updated', data: row });
}

// Safe delete: refuses when expenses still reference the category, unless the
// caller supplies ?reassign_to=<other category id>, in which case the expenses
// are moved first inside a single transaction.
function remove(req, res) {
  const userId = req.user.id;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) throw new AppError('Category not found', 404);

  const used = db.prepare('SELECT COUNT(*) AS n FROM expenses WHERE category_id = ? AND user_id = ?').get(id, userId).n;
  const reassignTo = req.query.reassign_to ? Number(req.query.reassign_to) : null;

  if (used > 0 && !reassignTo) {
    throw new AppError(
      `Cannot delete "${existing.name}": ${used} expense(s) still use it. Reassign them to another category first.`,
      409,
      [{ field: 'category', message: 'in_use', count: used }]
    );
  }

  if (reassignTo) {
    if (reassignTo === id) throw new AppError('Choose a different category to reassign expenses to', 400);
    const target = db.prepare('SELECT 1 FROM categories WHERE id = ? AND user_id = ?').get(reassignTo, userId);
    if (!target) {
      throw new AppError('Target category for reassignment does not exist in your account', 400);
    }
  }

  db.transaction(() => {
    if (used > 0) {
      db.prepare(
        'UPDATE expenses SET category_id = ?, updated_at = ? WHERE category_id = ? AND user_id = ?'
      ).run(reassignTo, new Date().toISOString(), id, userId);
    }
    db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, userId);
  })();

  res.json({
    success: true,
    message: used > 0 ? `Category deleted; ${used} expense(s) reassigned` : 'Category deleted',
  });
}

module.exports = { list, create, update, remove };
