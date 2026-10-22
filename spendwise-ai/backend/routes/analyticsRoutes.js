const express = require('express');
const { query } = require('express-validator');
const ctrl = require('../controllers/analyticsController');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { isValidISODate, isValidMonth, daysInclusive } = require('../utils/dateUtils');

const router = express.Router();

// All analytics routes require authentication
router.use(requireAuth);

const monthRule = (name) => query(name).optional({ values: 'falsy' }).custom(isValidMonth).withMessage(`${name} must be in YYYY-MM format`);
const dateRules = [
  query('start_date').optional({ values: 'falsy' }).custom(isValidISODate).withMessage('start_date must be a valid YYYY-MM-DD date'),
  query('end_date').optional({ values: 'falsy' }).custom(isValidISODate).withMessage('end_date must be a valid YYYY-MM-DD date'),
  query('end_date')
    .optional({ values: 'falsy' })
    .custom((v, { req }) => {
      const s = req.query.start_date;
      if (!s || !isValidISODate(s) || !isValidISODate(v)) return true;
      if (v < s) throw new Error('end_date cannot be before start_date');
      if (daysInclusive(s, v) > 3660) throw new Error('Date range is too large (max 10 years)');
      return true;
    }),
];

router.get('/dashboard', monthRule('month'), validate, ctrl.dashboard);
router.get('/monthly', monthRule('start_month'), monthRule('end_month'), validate, ctrl.monthly);
router.get('/categories', dateRules, validate, ctrl.categories);
router.get('/daily', dateRules, validate, ctrl.daily);
router.get('/comparison', monthRule('month'), validate, ctrl.comparison);

module.exports = router;
