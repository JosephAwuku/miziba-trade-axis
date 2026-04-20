'use strict';

require('dotenv').config();
const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const pinoHttp = require('pino-http');
const { Pool } = require('pg');
const redis    = require('redis');

const { authenticate } = require('../core/rbac');
const errorHandler     = require('./middleware/errors');
const rateLimiter      = require('./middleware/rate-limit');

// Routes
const authRoutes = require('./routes/auth');
const tradeRoutes = require('./routes/trades');
const {
  validationRouter:   validationRoutes,
  riskRouter:         riskRoutes,
  fdpRouter:          fdpRoutes,
  settlementRouter:   settlementRoutes,
  documentRouter:     documentRoutes,
  portfolioRouter:    portfolioRoutes,
  notificationRouter: notificationRoutes,
  webhookRouter:      webhookRoutes,
  adminRouter:        adminRoutes,
} = require('./routes/all-routes');

// ─── DATABASE ─────────────────────────────────────────────────────────────────

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on('error', (err) => {
  console.error('Unexpected DB error', err);
  process.exit(1);
});

// ─── REDIS ────────────────────────────────────────────────────────────────────

const cache = redis.createClient({ url: process.env.REDIS_URL });
cache.on('error', (err) => console.error('Redis error', err));
cache.connect().then(() => console.log('Redis connected'));

// ─── APP ──────────────────────────────────────────────────────────────────────

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['https://tradeaxis.miziba.com'],
  credentials: true,
}));
app.use(pinoHttp({ level: process.env.LOG_LEVEL || 'info' }));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimiter);

// Expose db and cache on req for route handlers
app.use((req, _res, next) => {
  req.db    = db;
  req.cache = cache;
  next();
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Public
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  version: process.env.npm_package_version || '1.0.0',
  timestamp: new Date().toISOString(),
}));

app.use('/v1/auth',         authRoutes);
app.use('/v1/webhooks',     webhookRoutes);   // HMAC-validated, no JWT

// Protected — all routes below require valid JWT
app.use(authenticate(db, process.env.JWT_SECRET));

app.use('/v1/trades',        tradeRoutes);
app.use('/v1/trades',        validationRoutes);
app.use('/v1/trades',        riskRoutes);
app.use('/v1/trades',        fdpRoutes);
app.use('/v1/trades',        settlementRoutes);
app.use('/v1/trades',        documentRoutes);
app.use('/v1/risk',          riskRoutes);
app.use('/v1/portfolio',     portfolioRoutes);
app.use('/v1/notifications', notificationRoutes);
app.use('/v1/admin',         adminRoutes);

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── START ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TradeAxis API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

module.exports = { app, db, cache };
