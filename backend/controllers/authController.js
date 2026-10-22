const bcrypt = require('bcryptjs');
const db = require('../database/database');
const { seedUserCategories } = require('../database/database');

/**
 * Register a new user account.
 */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if account already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const now = new Date().toISOString();

    let userId;
    db.transaction(() => {
      const result = db.prepare(
        'INSERT INTO users (name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run(name.trim(), normalizedEmail, passwordHash, now, now);
      userId = result.lastInsertRowid;

      // Seed default user settings
      db.prepare(
        'INSERT INTO user_settings (user_id, display_name, page_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run(userId, name.trim(), 10, now, now);

      // Seed 12 default categories for this user
      seedUserCategories(userId);
    })();

    // Establish secure session
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = userId;
      return res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        data: {
          id: userId,
          name: name.trim(),
          email: normalizedEmail,
        },
      });
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Log in with email and password.
 */
async function login(req, res, next) {
  try {
    const { email, password, rememberMe } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    const user = db.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Regenerate session to prevent session fixation attacks
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;

      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      } else {
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 1 day
      }

      const settings = db.prepare('SELECT display_name, page_size FROM user_settings WHERE user_id = ?').get(user.id);

      return res.json({
        success: true,
        message: 'Login successful.',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          settings: settings || { display_name: user.name, page_size: 10 },
        },
      });
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Log out and invalidate session.
 */
function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid', { path: '/' });
    return res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  });
}

/**
 * Get current authenticated user profile and settings.
 */
function me(req, res) {
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.user.id);
  const settings = db.prepare('SELECT display_name, page_size, theme FROM user_settings WHERE user_id = ?').get(req.user.id);

  res.json({
    success: true,
    data: {
      user,
      settings: settings || { display_name: user.name, page_size: 10, theme: 'light' },
    },
  });
}

/**
 * Change account password.
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user.id);

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    const now = new Date().toISOString();

    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, req.user.id);

    res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update user display name and table preferences.
 */
function updateProfile(req, res) {
  const { name, pageSize } = req.body;
  const now = new Date().toISOString();

  db.transaction(() => {
    if (name) {
      db.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), now, req.user.id);
    }
    db.prepare(
      `INSERT INTO user_settings (user_id, display_name, page_size, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = COALESCE(?, display_name),
         page_size = COALESCE(?, page_size),
         updated_at = ?`
    ).run(req.user.id, name ? name.trim() : null, pageSize || 10, now, now, name ? name.trim() : null, pageSize || null, now);
  })();

  const updatedSettings = db.prepare('SELECT display_name, page_size FROM user_settings WHERE user_id = ?').get(req.user.id);

  res.json({
    success: true,
    message: 'Profile settings updated.',
    data: updatedSettings,
  });
}

/**
 * Seed sample demo data for current user.
 */
function seedDemo(req, res) {
  const { seedDemoData } = require('../database/seed');
  const months = req.body?.months ? Math.min(12, Math.max(1, parseInt(req.body.months, 10))) : 3;
  const clearFirst = req.body?.clearFirst === true;

  if (clearFirst) {
    db.prepare('DELETE FROM expenses WHERE user_id = ?').run(req.user.id);
  }

  const count = seedDemoData(req.user.id, months, true);
  res.json({
    success: true,
    message: `Added ${count} sample expenses to your account across the last ${months} month(s).`,
    data: { seeded: count, months, clearFirst },
  });
}

module.exports = {
  register,
  login,
  logout,
  me,
  changePassword,
  updateProfile,
  seedDemo,
};
