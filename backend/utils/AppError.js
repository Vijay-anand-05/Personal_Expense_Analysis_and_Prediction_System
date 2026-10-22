// Error with an HTTP status, thrown from controllers and handled centrally.
class AppError extends Error {
  constructor(message, status = 500, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

module.exports = AppError;
