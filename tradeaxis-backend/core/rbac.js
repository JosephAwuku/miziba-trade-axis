/**
 * TRADEAXIS — ROLE-BASED ACCESS CONTROL
 * Miziba Infrastructure Ltd | Module 4
 *
 * Roles: deal_officer | ceo | cfo | trader | finance_partner
 * Enforced as Express middleware on every protected route.
 */

'use strict';

// ─── PERMISSIONS MATRIX ───────────────────────────────────────────────────────
// Format: resource.action
// Values: array of roles that may perform the action

const PERMISSIONS = {

  // ── TRADES ─────────────────────────────────────────────────────────────────
  'trade.list':           ['deal_officer', 'ceo', 'cfo'],
  'trade.list.own':       ['trader'],               // trader sees own trades only
  'trade.list.assigned':  ['finance_partner'],      // FP sees FINANCE_REVIEW + own portfolio
  'trade.view':           ['deal_officer', 'ceo', 'cfo', 'trader', 'finance_partner'],
  'trade.create':         ['trader'],
  'trade.advance_stage':  ['deal_officer', 'ceo'],
  'trade.decline':        ['deal_officer', 'ceo'],
  'trade.close':          ['deal_officer', 'ceo'],

  // ── VALIDATION ─────────────────────────────────────────────────────────────
  'validation.view':      ['deal_officer', 'ceo'],
  'validation.update':    ['deal_officer', 'ceo'],
  'validation.escalate':  ['deal_officer'],
  'escalation.decide':    ['ceo'],

  // ── RISK SCORING ───────────────────────────────────────────────────────────
  'risk.view':            ['deal_officer', 'ceo', 'finance_partner'],
  'risk.set':             ['deal_officer', 'ceo'],
  'risk.calculator':      ['deal_officer', 'ceo'],

  // ── FINANCE DATA PACKAGE ───────────────────────────────────────────────────
  'fdp.view':             ['deal_officer', 'ceo', 'finance_partner'],
  'fdp.generate':         ['deal_officer', 'ceo'],
  'fdp.send':             ['deal_officer', 'ceo'],
  'fdp.download':         ['deal_officer', 'ceo', 'finance_partner'],

  // ── FP DECISION ────────────────────────────────────────────────────────────
  'fp_decision.make':     ['finance_partner'],
  'fp_decision.view':     ['deal_officer', 'ceo'],

  // ── DEPLOYMENT ─────────────────────────────────────────────────────────────
  'deployment.view':      ['deal_officer', 'ceo', 'cfo', 'finance_partner'],
  'deployment.update':    ['deal_officer', 'ceo'],
  'batch.view':           ['deal_officer', 'ceo', 'finance_partner'],
  'batch.create':         ['deal_officer', 'ceo'],
  // FP view: farmer IDs anonymised (enforced in data layer, not just auth)

  // ── LOGISTICS ──────────────────────────────────────────────────────────────
  'logistics.view':       ['deal_officer', 'ceo', 'cfo', 'finance_partner'],
  'logistics.alerts.view':['deal_officer', 'ceo'],

  // ── SETTLEMENT ─────────────────────────────────────────────────────────────
  'settlement.view':      ['cfo', 'ceo', 'deal_officer', 'finance_partner'],
  'settlement.confirm':   ['cfo'],            // CFO-only: confirm buyer payment
  'settlement.waterfall': ['cfo', 'ceo'],     // Instruct TradeVault waterfall
  'non_payment.open':     ['deal_officer', 'ceo', 'cfo'],
  'non_payment.escalate': ['deal_officer', 'ceo', 'cfo'],
  'non_payment.view':     ['deal_officer', 'ceo', 'cfo', 'finance_partner'],

  // ── CLOSURE ────────────────────────────────────────────────────────────────
  'closure.view':         ['deal_officer', 'ceo'],
  'closure.update':       ['deal_officer', 'ceo'],
  'closure.lock':         ['deal_officer', 'ceo'],

  // ── DOCUMENTS ──────────────────────────────────────────────────────────────
  'document.view':        ['deal_officer', 'ceo', 'cfo', 'finance_partner', 'trader'],
  'document.upload':      ['deal_officer', 'ceo', 'trader'],
  'document.download':    ['deal_officer', 'ceo', 'cfo', 'finance_partner', 'trader'],
  // FP and trader can only access documents for their own associated trades

  // ── PORTFOLIO ──────────────────────────────────────────────────────────────
  'portfolio.view':       ['deal_officer', 'ceo', 'cfo'],
  'buyer_db.view':        ['deal_officer', 'ceo'],
  'fp_crm.view':          ['deal_officer', 'ceo'],
  'risk_history.view':    ['deal_officer', 'ceo'],

  // ── BUYERS ─────────────────────────────────────────────────────────────────
  'buyer_db.create':      ['deal_officer', 'ceo', 'ops_admin'],
  'buyer_db.update':      ['deal_officer', 'ceo', 'ops_admin'],

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  'notification.view':    ['deal_officer', 'ceo', 'cfo', 'trader', 'finance_partner'],
  'notification.read':    ['deal_officer', 'ceo', 'cfo', 'trader', 'finance_partner'],

  // ── ADMIN ───────────────────────────────────────────────────────────────────
  'org.create':           ['ceo', 'ops_admin'],
  'org.update':           ['ceo', 'ops_admin'],
  'user.create':          ['ceo', 'ops_admin'],
  'user.deactivate':      ['ceo', 'ops_admin'],
  'audit_log.view':       ['ceo', 'ops_admin'],
  // ops_admin specific
  'config.view':          ['ceo', 'ops_admin'],
  'config.update':        ['ops_admin'],
  'fp.onboarding.update': ['ceo', 'ops_admin', 'deal_officer'],

  // ── WEBHOOKS (internal endpoints) ──────────────────────────────────────────
  'webhook.receive':      ['__system__'],     // HMAC-validated, no user role
};

// ─── OWNERSHIP RULES ─────────────────────────────────────────────────────────
// Some permissions are role-allowed but further scoped by record ownership.
// These are checked in the service layer after fetching the record.

const OWNERSHIP_RULES = {
  // A trader can only view/act on their own trades
  trader: {
    trades:    (user, trade) => trade.trader_org_id === user.org_id,
    documents: (user, doc, trade) => trade.trader_org_id === user.org_id,
  },
  // A finance partner can only view trades assigned to them (FP or FINANCE_REVIEW stages)
  finance_partner: {
    trades:     (user, trade) => (
      trade.fp_org_id === user.org_id ||
      trade.stage === 'FINANCE_REVIEW'
    ),
    documents:  (user, doc, trade) => trade.fp_org_id === user.org_id,
    deployment: (user, trade) => trade.fp_org_id === user.org_id,
    logistics:  (user, trade) => trade.fp_org_id === user.org_id,
    batches:    (user, trade) => trade.fp_org_id === user.org_id,
    // Finance partner NEVER sees farmer IDs — enforced in serializer
  },
};

// ─── DATA REDACTION RULES ────────────────────────────────────────────────────
// Fields removed from API responses per role

const REDACT = {
  finance_partner: {
    batch: ['farmer_id_anon'],    // Replace with '****' in serializer
  },
  trader: {
    trade: ['fp_org_id', 'deal_officer_id'],
  },
};

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

/**
 * Express middleware factory.
 * Usage: router.get('/trades', requirePermission('trade.list'), handler)
 *
 * @param {...string} permissionKeys - One or more permissions (OR logic)
 */
function requirePermission(...permissionKeys) {
  return function (req, res, next) {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    const allowed = permissionKeys.some(key => {
      const roles = PERMISSIONS[key] || [];
      return roles.includes(user.role);
    });

    if (!allowed) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Your role (${user.role}) does not have permission for: ${permissionKeys.join(', ')}.`,
      });
    }

    next();
  };
}

/**
 * Checks ownership for a given resource and role.
 *
 * @param {string} role
 * @param {string} resource - e.g. 'trades'
 * @param {Object} user
 * @param {Object} record   - The fetched record
 * @param {Object} [trade]  - The parent trade (for document checks)
 * @returns {boolean}
 */
function checkOwnership(role, resource, user, record, trade) {
  const rules = OWNERSHIP_RULES[role];
  if (!rules || !rules[resource]) return true; // No ownership rule = allowed
  return rules[resource](user, record, trade);
}

/**
 * Redacts sensitive fields from a response object based on role.
 *
 * @param {string} role
 * @param {string} resourceType - e.g. 'batch'
 * @param {Object|Array} data
 * @returns {Object|Array} Redacted copy
 */
function redactForRole(role, resourceType, data) {
  const fieldsToRedact = (REDACT[role] || {})[resourceType] || [];
  if (!fieldsToRedact.length) return data;

  const redact = (obj) => {
    const copy = { ...obj };
    fieldsToRedact.forEach(f => {
      if (copy[f] !== undefined) copy[f] = '****';
    });
    return copy;
  };

  return Array.isArray(data) ? data.map(redact) : redact(data);
}

/**
 * JWT authentication middleware.
 * Validates Bearer token and attaches user to req.user.
 */
function authenticate(db, jwtSecret) {
  const jwt = require('jsonwebtoken');
  return async function (req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Bearer token required.' });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);

      // Check session is still valid in DB
      const session = await db.query(
        'SELECT s.id, u.id as user_id, u.email, u.full_name, u.role, u.org_id, u.is_active ' +
        'FROM sessions s JOIN users u ON u.id = s.user_id ' +
        'WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.is_active = true',
        [decoded.session_hash]
      );

      if (!session.rows.length) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Session expired or revoked.' });
      }

      req.user = session.rows[0];
      next();
    } catch (err) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token.' });
    }
  };
}

// ─── AUDIT LOG HELPER ─────────────────────────────────────────────────────────

/**
 * Logs an action to the audit_log table.
 * Call from service layer after every meaningful state change.
 */
async function auditLog(db, { userId, tradeId, action, entityType, entityId, oldValue, newValue, ipAddress }) {
  await db.query(
    `INSERT INTO audit_log (user_id, trade_id, action, entity_type, entity_id, old_value, new_value, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, tradeId || null, action, entityType, entityId || null,
     oldValue ? JSON.stringify(oldValue) : null,
     newValue ? JSON.stringify(newValue) : null,
     ipAddress || null]
  );
}

module.exports = {
  PERMISSIONS,
  OWNERSHIP_RULES,
  REDACT,
  requirePermission,
  checkOwnership,
  redactForRole,
  authenticate,
  auditLog,
};
