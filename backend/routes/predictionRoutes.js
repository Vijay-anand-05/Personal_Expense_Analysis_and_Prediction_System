const express = require('express');
const { query } = require('express-validator');
const ctrl = require('../controllers/predictionController');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { isValidMonth } = require('../utils/dateUtils');

const router = express.Router();

// All prediction routes require authentication
router.use(requireAuth);

const monthRule = query('month').optional({ values: 'falsy' }).custom(isValidMonth).withMessage('month must be in YYYY-MM format');

router.get('/month-end', monthRule, validate, ctrl.monthEnd);
router.get('/next-month', ctrl.nextMonth);
router.get('/categories', monthRule, validate, ctrl.categories);
router.get('/insights', monthRule, validate, ctrl.insights);

module.exports = router;
