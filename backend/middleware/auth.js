const db = require('../database/database');
const AppError = require('../utils/AppError');

/**
 * Authentication middleware that requires a valid server-side session.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }

  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    req.session.destroy();
    return res.status(401).json({
      success: false,
      message: 'Account not found or session expired. Please log in again.',
    });
  }

  req.user = user;
  next();
}

/**
 * Origin validation middleware to prevent CSRF attacks on state-changing API requests.
 */
function csrfCheck(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();

  // If user is not authenticated, let auth middleware handle 401
  if (!req.session || !req.session.userId) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;

  // Verify origin if present
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return res.status(403).json({ success: false, message: 'Cross-origin request rejected.' });
      }
    } catch {
      return res.status(403).json({ success: false, message: 'Invalid origin header.' });
    }
  } else if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host !== host) {
        return res.status(403).json({ success: false, message: 'Cross-site request rejected.' });
      }
    } catch {
      return res.status(403).json({ success: false, message: 'Invalid referer header.' });
    }
  }

  next();
}

module.exports = { requireAuth, csrfCheck };
