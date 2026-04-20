'use strict';

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { authenticator } = require('otplib');
const { body, validationResult } = require('express-validator');
const { auditLog } = require('../../core/rbac');

const FINANCIAL_ROLES = ['ceo', 'cfo', 'ops_admin'];
const SESSION_MINUTES = parseInt(process.env.SESSION_EXPIRY_MINUTES || '60', 10);

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function createToken(sessionHash) {
  return jwt.sign({ session_hash: sessionHash }, process.env.JWT_SECRET, {
    expiresIn: `${SESSION_MINUTES}m`,
  });
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ error: 'VALIDATION_ERROR', fields: errors.mapped() });

    const { email, password, totp_code } = req.body;
    const db = req.db;

    try {
      const result = await db.query(
        `SELECT u.*, o.name AS org_name FROM users u
         JOIN organisations o ON o.id = u.org_id
         WHERE u.email = $1`,
        [email]
      );

      const user = result.rows[0];

      // Generic error — don't reveal whether email exists
      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials.' });
      }

      // Check lockout
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return res.status(429).json({
          error: 'ACCOUNT_LOCKED',
          message: `Account locked. Try again after ${user.locked_until}.`,
        });
      }

      // Verify password
      const passwordOk = await bcrypt.compare(password, user.password_hash);
      if (!passwordOk) {
        const newFailed = user.failed_logins + 1;
        const lockout = newFailed >= 5 ? new Date(Date.now() + 15 * 60000) : null;
        await db.query(
          'UPDATE users SET failed_logins=$1, locked_until=$2 WHERE id=$3',
          [newFailed, lockout, user.id]
        );
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials.' });
      }

      // 2FA: MANDATORY for financial roles
      if (FINANCIAL_ROLES.includes(user.role)) {
        if (!user.totp_enabled || !user.totp_secret) {
          return res.status(403).json({
            error: '2FA_REQUIRED',
            message: 'Two-factor authentication must be configured before accessing this role. Contact Ops Admin.',
          });
        }
        if (!totp_code) {
          return res.status(403).json({
            error: '2FA_CODE_REQUIRED',
            message: 'TOTP code required for this role.',
          });
        }
        const totpValid = authenticator.verify({ token: totp_code, secret: user.totp_secret });
        if (!totpValid) {
          return res.status(401).json({ error: 'INVALID_2FA', message: 'Invalid TOTP code.' });
        }
      }

      // Optional 2FA for other roles (if configured)
      if (!FINANCIAL_ROLES.includes(user.role) && user.totp_enabled && totp_code) {
        const totpValid = authenticator.verify({ token: totp_code, secret: user.totp_secret });
        if (!totpValid) {
          return res.status(401).json({ error: 'INVALID_2FA', message: 'Invalid TOTP code.' });
        }
      }

      // Clear failed logins, create session
      await db.query('UPDATE users SET failed_logins=0, locked_until=NULL, last_login_at=NOW() WHERE id=$1', [user.id]);

      const rawToken = crypto.randomBytes(48).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60000);

      await db.query(
        `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, tokenHash, expiresAt, req.ip, req.headers['user-agent']]
      );

      const token = createToken(tokenHash);

      await auditLog(db, {
        userId: user.id, action: 'LOGIN', entityType: 'session',
        entityId: user.id, ipAddress: req.ip,
      });

      return res.json({
        token,
        expires_at: expiresAt.toISOString(),
        user: {
          id: user.id, email: user.email, full_name: user.full_name,
          role: user.role, org_id: user.org_id, org_name: user.org_name,
          totp_enabled: user.totp_enabled,
        },
      });
    } catch (err) { next(err); }
  }
);

// ─── POST /auth/logout ────────────────────────────────────────────────────────

router.post('/logout', async (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.sendStatus(204);
  try {
    const hash = hashToken(token);
    await req.db.query('DELETE FROM sessions WHERE token_hash = $1', [hash]);
    res.sendStatus(204);
  } catch (err) { next(err); }
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

router.post('/refresh', async (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const { db } = req;
    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true }); }
    catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }

    const result = await db.query(
      `SELECT s.*, u.role FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND u.is_active = true`,
      [decoded.session_hash]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'SESSION_NOT_FOUND' });
    }

    const session = result.rows[0];

    // Financial roles require 2FA re-confirmation for refresh (step-up auth)
    if (FINANCIAL_ROLES.includes(session.role) && !req.body.totp_code) {
      return res.status(403).json({
        error: '2FA_REAUTH_REQUIRED',
        message: 'TOTP code required to refresh session for this role.',
      });
    }

    // Issue new token, extend session
    const newExpiry = new Date(Date.now() + SESSION_MINUTES * 60000);
    await db.query('UPDATE sessions SET expires_at=$1 WHERE token_hash=$2', [newExpiry, decoded.session_hash]);

    const newToken = createToken(decoded.session_hash);
    res.json({ token: newToken, expires_at: newExpiry.toISOString() });
  } catch (err) { next(err); }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get('/me', async (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await req.db.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.org_id, u.totp_enabled, o.name AS org_name
       FROM sessions s JOIN users u ON u.id=s.user_id JOIN organisations o ON o.id=u.org_id
       WHERE s.token_hash=$1 AND s.expires_at > NOW() AND u.is_active=true`,
      [decoded.session_hash]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'SESSION_EXPIRED' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// ─── POST /auth/2fa/setup ─────────────────────────────────────────────────────

router.post('/2fa/setup', async (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const { db } = req;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await db.query(
      'SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>NOW()',
      [decoded.session_hash]
    );
    if (!session.rows.length) return res.status(401).json({ error: 'SESSION_EXPIRED' });
    const userId = session.rows[0].user_id;

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      req.body.email || userId,
      'TradeAxis · Miziba',
      secret
    );

    // Store secret but do NOT enable 2FA yet — only enabled after verification
    await db.query('UPDATE users SET totp_secret=$1, totp_enabled=FALSE WHERE id=$2', [secret, userId]);

    res.json({
      secret,
      otpauth_url: otpauthUrl,
      message: 'Scan QR code in Google Authenticator, then call POST /auth/2fa/verify to activate.',
    });
  } catch (err) { next(err); }
});

// ─── POST /auth/2fa/verify ────────────────────────────────────────────────────

router.post('/2fa/verify',
  body('totp_code').isLength({ min: 6, max: 6 }).isNumeric(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ error: 'VALIDATION_ERROR', fields: errors.mapped() });

    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });

    try {
      const { db } = req;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const session = await db.query(
        'SELECT s.user_id, u.totp_secret FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()',
        [decoded.session_hash]
      );
      if (!session.rows.length) return res.status(401).json({ error: 'SESSION_EXPIRED' });

      const { user_id, totp_secret } = session.rows[0];
      if (!totp_secret) return res.status(400).json({ error: '2FA_NOT_SETUP', message: 'Call /auth/2fa/setup first.' });

      const valid = authenticator.verify({ token: req.body.totp_code, secret: totp_secret });
      if (!valid) return res.status(401).json({ error: 'INVALID_2FA', message: 'Incorrect TOTP code.' });

      await db.query('UPDATE users SET totp_enabled=TRUE WHERE id=$1', [user_id]);
      await auditLog(db, { userId: user_id, action: '2FA_ENABLED', entityType: 'user', entityId: user_id, ipAddress: req.ip });

      res.json({ message: '2FA enabled successfully.' });
    } catch (err) { next(err); }
  }
);

// ─── POST /auth/forgot-password ───────────────────────────────────────────────

router.post('/forgot-password',
  body('email').isEmail().normalizeEmail(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ error: 'VALIDATION_ERROR' });

    try {
      const { db } = req;
      const result = await db.query('SELECT id FROM users WHERE email=$1 AND is_active=TRUE', [req.body.email]);

      // Always return 200 — don't reveal if email exists
      if (result.rows.length) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60000); // 1 hour
        await db.query(
          'UPDATE users SET password_reset_token=$1, password_reset_expires_at=$2 WHERE id=$3',
          [token, expires, result.rows[0].id]
        );
        // Queue email notification via SQS
        // notificationQueue.send({ type: 'PASSWORD_RESET', userId: result.rows[0].id, token });
      }

      res.json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (err) { next(err); }
  }
);

// ─── POST /auth/reset-password ────────────────────────────────────────────────

router.post('/reset-password',
  body('token').isLength({ min: 64, max: 64 }),
  body('new_password').isLength({ min: 12 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ error: 'VALIDATION_ERROR', fields: errors.mapped() });

    const { token, new_password } = req.body;
    try {
      const { db } = req;
      const result = await db.query(
        'SELECT id FROM users WHERE password_reset_token=$1 AND password_reset_expires_at>NOW() AND is_active=TRUE',
        [token]
      );
      if (!result.rows.length) {
        return res.status(400).json({ error: 'INVALID_TOKEN', message: 'Reset token is invalid or expired.' });
      }

      const hash = await bcrypt.hash(new_password, 12);
      await db.query(
        'UPDATE users SET password_hash=$1, password_reset_token=NULL, password_reset_expires_at=NULL, failed_logins=0 WHERE id=$2',
        [hash, result.rows[0].id]
      );
      // Revoke all existing sessions for security
      await db.query('DELETE FROM sessions WHERE user_id=$1', [result.rows[0].id]);
      await auditLog(db, { userId: result.rows[0].id, action: 'PASSWORD_RESET', entityType: 'user', entityId: result.rows[0].id, ipAddress: req.ip });

      res.json({ message: 'Password reset successfully. Please log in again.' });
    } catch (err) { next(err); }
  }
);

// ─── DELETE /auth/sessions ────────────────────────────────────────────────────
// Revoke all sessions for current user (security log-out-everywhere)

router.delete('/sessions', async (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await req.db.query('SELECT user_id FROM sessions WHERE token_hash=$1', [decoded.session_hash]);
    if (!session.rows.length) return res.sendStatus(204);
    await req.db.query('DELETE FROM sessions WHERE user_id=$1', [session.rows[0].user_id]);
    res.sendStatus(204);
  } catch (err) { next(err); }
});

module.exports = router;
