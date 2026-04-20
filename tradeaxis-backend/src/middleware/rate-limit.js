'use strict';

const rateLimit = require('express-rate-limit');

// ─── RATE LIMITER ─────────────────────────────────────────────────────────────

const rateLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 100,                   // 100 req/min per IP (general)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Try again in 1 minute.' },
  skip: (req) => req.path === '/health',
});

const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,                    // 10 attempts/min on auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many authentication attempts.' },
});

module.exports = rateLimiter;
module.exports.authRateLimiter = authRateLimiter;

// ─── IDEMPOTENCY MIDDLEWARE ───────────────────────────────────────────────────
// Apply to all financial POST endpoints:
//   POST /trades (application)
//   POST /trades/:id/settlement (CFO payment confirmation)
//   POST /trades/:id/fdp/send (FDP send)
//   POST /trades/:id/fp-decision (FP approve/decline)
//   POST /trades/:id/non-payment (open protocol)

async function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];

  if (!key) {
    return res.status(400).json({
      error: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Idempotency-Key header is required for this endpoint.',
    });
  }

  if (key.length < 16 || key.length > 128) {
    return res.status(400).json({
      error: 'INVALID_IDEMPOTENCY_KEY',
      message: 'Idempotency-Key must be 16–128 characters.',
    });
  }

  const db = req.db;
  const userId = req.user?.id;

  try {
    // Check for existing response
    const existing = await db.query(
      'SELECT response FROM idempotency_keys WHERE key=$1 AND user_id=$2 AND endpoint=$3',
      [key, userId, req.path]
    );

    if (existing.rows.length) {
      // Replay the original response
      const cached = existing.rows[0].response;
      return res.status(cached.status || 200).json(cached.body);
    }

    // Intercept the response to store it
    const originalJson = res.json.bind(res);
    res.json = function(body) {
      // Store idempotency record (fire-and-forget, non-blocking)
      db.query(
        'INSERT INTO idempotency_keys (key, user_id, endpoint, response) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [key, userId, req.path, JSON.stringify({ status: res.statusCode, body })]
      ).catch((err) => console.error('Idempotency store error:', err));

      return originalJson(body);
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports.idempotency = idempotency;

// ─── CENTS SERIALISER ─────────────────────────────────────────────────────────
// Converts USD decimal fields to BIGINT cents in API responses.
// Per spec §15: "All monetary values in API responses: USD cents (BIGINT)"

const MONEY_FIELDS = new Set([
  'contract_value_usd', 'procurement_cost_usd', 'trader_equity_usd',
  'finance_facility_usd', 'miziba_struct_fee_usd', 'miziba_settle_fee_usd',
  'buyer_payment_usd', 'fp_principal_usd', 'fp_fee_usd', 'fp_total_usd',
  'miziba_fee_usd', 'trader_margin_usd', 'shortfall_amount_usd',
  'tranche_amount_usd', 'facility_amount_usd', 'min_deal_size_usd',
  'max_deal_size_usd', 'total_value_usd', 'total_contract_value_usd',
  'total_facility_usd', 'amount_usd', 'price_per_mt_usd',
]);

function toCents(val) {
  if (val === null || val === undefined) return val;
  return Math.round(parseFloat(val) * 100);
}

function serialiseMonetary(obj) {
  if (Array.isArray(obj)) return obj.map(serialiseMonetary);
  if (obj === null || typeof obj !== 'object') return obj;

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (MONEY_FIELDS.has(k)) {
      out[k] = toCents(v);
    } else if (typeof v === 'object' && v !== null) {
      out[k] = serialiseMonetary(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function fromCents(val) {
  if (val === null || val === undefined) return val;
  return parseFloat(val) / 100;
}

// Deserialise incoming cents to USD decimal for DB writes
function deserialiseMonetary(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = MONEY_FIELDS.has(k) ? fromCents(v) : v;
  }
  return out;
}

// Express middleware: wrap res.json to auto-serialise monetary fields
function monetarySerialiser(_req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function(body) {
    return originalJson(serialiseMonetary(body));
  };
  next();
}

module.exports.monetarySerialiser = monetarySerialiser;
module.exports.serialiseMonetary = serialiseMonetary;
module.exports.deserialiseMonetary = deserialiseMonetary;
module.exports.toCents = toCents;
module.exports.fromCents = fromCents;
module.exports.MONEY_FIELDS = MONEY_FIELDS;
