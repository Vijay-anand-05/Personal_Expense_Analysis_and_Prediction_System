const express = require('express');
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/categoryController');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { ICON_IDS } = require('../utils/defaultCategories');

const router = express.Router();

// All category endpoints require authentication
router.use(requireAuth);

const idRule = param('id').isInt({ min: 1 }).withMessage('Invalid category id');

const bodyRules = [
  body('name').isString().withMessage('Category name is required').trim().notEmpty().withMessage('Category name is required')
    .isLength({ max: 40 }).withMessage('Category name must be at most 40 characters'),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Color must be a hex value like #A1B2C3'),
  body('icon').optional().isIn(ICON_IDS).withMessage('Unknown icon'),
  body('monthly_budget').optional().isFloat({ min: 0, max: 1000000000 }).withMessage('Monthly budget must be zero or more').toFloat(),
];

router.get('/', ctrl.list);
router.post('/', bodyRules, validate, ctrl.create);
router.put('/:id', idRule, bodyRules, validate, ctrl.update);
router.delete(
  '/:id',
  idRule,
  query('reassign_to').optional().isInt({ min: 1 }).withMessage('Invalid reassign_to category id'),
  validate,
  ctrl.remove
);

module.exports = router;
