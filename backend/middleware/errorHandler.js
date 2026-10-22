const AppError = require('../utils/AppError');

function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body';
  } else if (typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    status = 409;
    message = err.code.includes('UNIQUE')
      ? 'A record with the same unique value already exists'
      : 'The operation violates a database constraint';
  } else if (err.message === 'Not allowed by CORS') {
    status = 403;
  } else if (!(err instanceof AppError) && status >= 500) {
    // Log the details server-side only; never leak internals to the client.
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err.stack || err);
    message = 'Internal server error';
  }

  res.status(status).json({ success: false, message, ...(err.details ? { errors: err.details } : {}) });
}

module.exports = { notFound, errorHandler };
