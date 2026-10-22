const { validationResult } = require('express-validator');

// Turns express-validator results into a consistent 400 response.
module.exports = function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array({ onlyFirstError: true }).map((e) => ({ field: e.path, message: e.msg }));
  return res.status(400).json({
    success: false,
    message: `Validation failed: ${errors.map((e) => e.message).join('; ')}`,
    errors,
  });
};
