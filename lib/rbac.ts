/**
 * TRADEAXIS — ROLE-BASED ACCESS CONTROL
 * Miziba Infrastructure Ltd | Module 4
 *
 * Roles: deal_officer | ceo | cfo | trader | finance_partner
 * Enforced as middleware in Next.js API routes.
 */

import { Role, User, Trade, Document } from './types';

// ─── PERMISSIONS MATRIX ───────────────────────────────────────────────────────
// Format: resource.action
// Values: array of roles that may perform the action

const PERMISSIONS: Record<string, Role[]> = {
  // ── TRADES ─────────────────────────────────────────────────────────────────
  'trade.list': ['deal_officer', 'ceo', 'cfo', 'ops_admin'],
  'trade.list.own': ['trader'],
  'trade.list.assigned': ['finance_partner'],
  'trade.view': ['deal_officer', 'ceo', 'cfo', 'trader', 'finance_partner', 'ops_admin'],
  'trade.create': ['trader'],
  'trade.advance_stage': ['deal_officer', 'ceo'],
  'trade.decline': ['deal_officer', 'ceo'],
  'trade.close': ['deal_officer', 'ceo'],

  // ── VALIDATION ─────────────────────────────────────────────────────────────
  'validation.view': ['deal_officer', 'ceo'],
  'validation.update': ['deal_officer', 'ceo'],
  'validation.escalate': ['deal_officer'],
  'escalation.decide': ['ceo'],

  // ── RISK SCORING ───────────────────────────────────────────────────────────
  'risk.view': ['deal_officer', 'ceo', 'finance_partner'],
  'risk.set': ['deal_officer', 'ceo'],
  'risk.calculator': ['deal_officer', 'ceo'],

  // ── FINANCE DATA PACKAGE ───────────────────────────────────────────────────
  'fdp.view': ['deal_officer', 'ceo', 'finance_partner'],
  'fdp.generate': ['deal_officer', 'ceo'],
  'fdp.send': ['deal_officer', 'ceo'],
  'fdp.download': ['deal_officer', 'ceo', 'finance_partner'],

  // ── FP DECISION ────────────────────────────────────────────────────────────
  'fp_decision.make': ['finance_partner'],
  'fp_decision.view': ['deal_officer', 'ceo'],

  // ── DEPLOYMENT ─────────────────────────────────────────────────────────────
  'deployment.view': ['deal_officer', 'ceo', 'cfo', 'finance_partner'],
  'deployment.update': ['deal_officer', 'ceo'],
  'batch.view': ['deal_officer', 'ceo', 'finance_partner'],
  'batch.create': ['deal_officer', 'ceo'],

  // ── LOGISTICS ─────────────────────────────────────────────────────────────
  'logistics.view': ['deal_officer', 'ceo', 'cfo', 'finance_partner'],
  'logistics.alerts.view': ['deal_officer', 'ceo'],

  // ── SETTLEMENT ─────────────────────────────────────────────────────────────
  'settlement.view': ['cfo', 'ceo', 'deal_officer', 'finance_partner'],
  'settlement.confirm': ['cfo'],
  'settlement.waterfall': ['cfo', 'ceo'],
  'non_payment.open': ['deal_officer', 'ceo', 'cfo'],
  'non_payment.escalate': ['deal_officer', 'ceo', 'cfo'],
  'non_payment.view': ['deal_officer', 'ceo', 'cfo', 'finance_partner'],

  // ── CLOSURE ────────────────────────────────────────────────────────────────
  'closure.view': ['deal_officer', 'ceo'],
  'closure.update': ['deal_officer', 'ceo'],
  'closure.lock': ['deal_officer', 'ceo'],

  // ── DOCUMENTS ──────────────────────────────────────────────────────────────
  'document.view': ['deal_officer', 'ceo', 'cfo', 'finance_partner', 'trader'],
  'document.upload': ['deal_officer', 'ceo', 'trader'],
  'document.download': ['deal_officer', 'ceo', 'cfo', 'finance_partner', 'trader'],

  // ── PORTFOLIO ──────────────────────────────────────────────────────────────
  'portfolio.view': ['deal_officer', 'ceo', 'cfo', 'ops_admin'],
  'buyer_db.view': ['deal_officer', 'ceo', 'ops_admin'],
  'fp_crm.view': ['deal_officer', 'ceo'],
  'risk_history.view': ['deal_officer', 'ceo', 'ops_admin'],

  // ── BUYERS ─────────────────────────────────────────────────────────────────
  'buyer_db.create': ['deal_officer', 'ceo', 'ops_admin'],
  'buyer_db.update': ['deal_officer', 'ceo', 'ops_admin'],

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  'notification.view': ['deal_officer', 'ceo', 'cfo', 'trader', 'finance_partner', 'ops_admin'],
  'notification.read': ['deal_officer', 'ceo', 'cfo', 'trader', 'finance_partner', 'ops_admin'],

  // ── ADMIN ───────────────────────────────────────────────────────────────────
  'org.create': ['ceo', 'ops_admin'],
  'org.update': ['ceo', 'ops_admin'],
  'user.create': ['ceo', 'ops_admin'],
  'user.deactivate': ['ceo', 'ops_admin'],
  'audit_log.view': ['ceo', 'ops_admin'],
  'config.view': ['ceo', 'ops_admin'],
  'config.update': ['ops_admin'],
  'fp.onboarding.update': ['ceo', 'ops_admin', 'deal_officer'],
  'kyc.review': ['ceo', 'ops_admin'],
  'kyc.approve': ['ceo', 'ops_admin'],

  // ── WEBHOOKS ───────────────────────────────────────────────────────────────
  'webhook.receive': ['__system__'],
};

// ─── OWNERSHIP RULES ─────────────────────────────────────────────────────────
// Some permissions are role-allowed but further scoped by record ownership.
// These are checked in the service layer after fetching the record.

const OWNERSHIP_RULES: Record<string, Record<string, (user: User, record: any, trade?: Trade) => boolean>> = {
  trader: {
    trades: (user, trade) => trade.trader_org_id === user.org_id,
    documents: (user, doc, trade) => trade?.trader_org_id === user.org_id,
  },
  finance_partner: {
    trades: (user, trade) => (
      trade.fp_org_id === user.org_id ||
      trade.stage === 'FINANCE_REVIEW'
    ),
    documents: (user, doc, trade) => trade?.fp_org_id === user.org_id,
    deployment: (user, trade) => trade.fp_org_id === user.org_id,
    logistics: (user, trade) => trade.fp_org_id === user.org_id,
    batches: (user, trade) => trade.fp_org_id === user.org_id,
  },
};

// ─── DATA REDACTION RULES ────────────────────────────────────────────────────
// Fields removed from API responses per role

const REDACT: Record<string, Record<string, string[]>> = {
  finance_partner: {
    batch: ['farmer_id_anon'],
  },
  trader: {
    trade: ['fp_org_id', 'deal_officer_id'],
  },
};

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

/**
 * Express middleware factory.
 * Usage: router.get('/trades', requirePermission('trade.list'), handler)
 */
export function requirePermission(...permissionKeys: string[]) {
  return function (req: any, res: any, next: any) {
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
 */
export function hasPermission(user: User, permission: string): boolean {
  const allowedRoles = PERMISSIONS[permission] || [];
  return allowedRoles.includes(user.role);
}

/**
 * Checks ownership for a given resource and role.
 */
export function checkOwnership(role: Role, resource: string, user: User, record: any, trade?: Trade): boolean {
  if (!role) return true;
  const rules = OWNERSHIP_RULES[role as string];
  if (!rules || !rules[resource]) return true; // No ownership rule = allowed
  return rules[resource](user, record, trade);
}

/**
 * Redacts sensitive fields from a response object based on role.
 */
export function redactForRole(role: Role, resourceType: string, data: any): any {
  if (!role) return data;
  const fieldsToRedact = (REDACT[role as string] || {})[resourceType] || [];
  if (!fieldsToRedact.length) return data;

  const redact = (obj: any) => {
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
export function authenticate(jwtSecret: string) {
  const jwt = require('jsonwebtoken');
  return async function (req: any, res: any, next: any) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Bearer token required.' });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);

      // Check session is still valid in DB
      // For Supabase, this would be handled by Supabase auth
      // For now, assume user is attached
      req.user = decoded.user;
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
export async function auditLog(
  db: any,
  {
    userId,
    tradeId,
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
    ipAddress,
  }: {
    userId: string;
    tradeId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
  }
) {
  await db.query(
    `INSERT INTO audit_log (user_id, trade_id, action, entity_type, entity_id, old_value, new_value, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      userId,
      tradeId || null,
      action,
      entityType,
      entityId || null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ipAddress || null,
    ]
  );
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

export {
  PERMISSIONS,
  OWNERSHIP_RULES,
  REDACT,
};