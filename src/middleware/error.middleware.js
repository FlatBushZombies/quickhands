import logger from '#config/logger.js';

export function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode =
    Number.isInteger(error?.statusCode) && error.statusCode >= 400
      ? error.statusCode
      : 500;

  logger.error('Unhandled request error', {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: error?.message,
    stack: error?.stack,
  });

  return res.status(statusCode).json({
    success: false,
    message: error?.message || 'Internal server error',
  });
}
