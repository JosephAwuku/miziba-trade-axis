/**
 * TRADEAXIS — MIDDLEWARE SUITE
 * errors.js  — Global error handler
 * idempotency.js — Idempotency-Key enforcement for financial endpoints
 * rate-limit.js  — Rate limiting per IP
 * serialise.js   — USD → cents serialiser for API responses
 */

'use strict';

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────

function errorHandler(err, req, res, _next) {
  const log = req.log || console;

  // Known application errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.code || 'APPLICATION_ERROR',
      message: err.message,
    });
  }

  // PostgreSQL constraint violations
  if (err.code === '23505') { // unique_violation
    return res.status(409).json({ error: 'CONFLICT', message: 'Record already exists.' });
  }
  if (err.code === '23503') { // foreign_key_violation
    return res.status(422).json({ error: 'REFERENCE_ERROR', message: 'Referenced record does not exist.' });
  }
  if (err.code === '23514') { // check_violation
    return res.status(422).json({ error: 'CONSTRAINT_VIOLATION', message: err.detail || err.message });
  }
  if (err.code === 'P0001') { // raise_exception (our custom triggers)
    return res.status(422).json({ error: 'BUSINESS_RULE_VIOLATION', message: err.message });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token is invalid.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Token has expired.' });
  }

  // Unhandled — log full error, return generic message
  log.error({ err }, 'Unhandled error');
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: isDev ? err.message : 'An internal error occurred.',
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = errorHandler;
