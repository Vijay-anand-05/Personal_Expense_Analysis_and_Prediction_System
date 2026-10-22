const express = require('express');
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/expenseController');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { isValidISODate } = require('../utils/dateUtils');
const { PAYMENT_METHODS } = require('../utils/defaultCategories');

const router = express.Router();

// All expense routes require authentication
router.use(requireAuth);

const idRule = param('id').isInt({ min: 1 }).withMessage('Invalid expense id');

const filterRules = [
  query('search').optional().isString().isLength({ max: 100 }).withMessage('Search text is too long'),
  query('category').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Invalid category filter'),
  query('payment_method').optional({ values: 'falsy' }).isIn(PAYMENT_METHODS).withMessage('Invalid payment method filter'),
  query('start_date').optional({ values: 'falsy' }).custom(isValidISODate).withMessage('start_date must be a valid YYYY-MM-DD date'),
  query('end_date').optional({ values: 'falsy' }).custom(isValidISODate).withMessage('end_date must be a valid YYYY-MM-DD date'),
  query('end_date')
    .optional({ values: 'falsy' })
    .custom((v, { req }) => !req.query.start_date || !isValidISODate(req.query.start_date) || v >= req.query.start_date)
    .withMessage('end_date cannot be before start_date'),
];

const pageRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

const bodyRules = [
  body('title').isString().withMessage('Title is required').trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 120 }).withMessage('Title must be at most 120 characters'),
  body('amount').isFloat({ gt: 0, max: 1000000000 }).withMessage('Amount must be a number greater than zero').toFloat(),
  body('category_id').isInt({ min: 1 }).withMessage('Category is required').toInt(),
  body('expense_date').custom(isValidISODate).withMessage('Date must be a valid YYYY-MM-DD date'),
  body('payment_method').isIn(PAYMENT_METHODS).withMessage(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`),
  body('notes').optional({ values: 'null' }).isString().withMessage('Notes must be text').trim()
    .isLength({ max: 500 }).withMessage('Notes must be at most 500 characters'),
];

router.get('/', filterRules, pageRules, validate, ctrl.list);
router.get('/export', filterRules, validate, ctrl.exportCsv); // must precede '/:id'
router.post('/truncate', ctrl.truncateExpenses);
router.delete('/truncate', ctrl.truncateExpenses);
router.post('/reset-tables', ctrl.resetTables);
router.get('/:id', idRule, validate, ctrl.getOne);
router.post('/', bodyRules, validate, ctrl.create);
router.put('/:id', idRule, bodyRules, validate, ctrl.update);
router.delete('/:id', idRule, validate, ctrl.remove);

module.exports = router;
