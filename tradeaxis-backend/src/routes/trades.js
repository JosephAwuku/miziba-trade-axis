'use strict';

const router = require('express').Router();
const { body, query, param, validationResult } = require('express-validator');
const { requirePermission, checkOwnership, auditLog } = require('../../core/rbac');
const { validateStageTransition, isTradeEditable } = require('../../core/business-logic');
const { idempotency, deserialiseMonetary } = require('../middleware/rate-limit');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'VALIDATION_ERROR', fields: errors.mapped() });
    return false;
  }
  return true;
}

async function fetchTrade(db, id) {
  const result = await db.query(`
    SELECT t.*,
           o.name  AS trader_name,
           b.name  AS buyer_name,  b.country AS buyer_country,
           fp.name AS fp_name,
           u.full_name AS officer_name
    FROM trades t
    JOIN organisations o ON o.id = t.trader_org_id
    JOIN buyers        b ON b.id = t.buyer_id
    LEFT JOIN organisations fp ON fp.id = t.fp_org_id
    LEFT JOIN users         u  ON u.id  = t.deal_officer_id
    WHERE t.id = $1`, [id]);
  return result.rows[0] || null;
}

// ─── GET /trades ──────────────────────────────────────────────────────────────

router.get('/',
  requirePermission('trade.list', 'trade.list.own', 'trade.list.assigned'),
  async (req, res, next) => {
    try {
      const { db, user } = req;
      const { stage, commodity, from_date, to_date, page = 1, per_page = 25 } = req.query;
      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(per_page));
      const limit  = Math.min(100, parseInt(per_page) || 25);

      const conditions = [];
      const params     = [];

      // Role-based scoping
      if (user.role === 'trader') {
        conditions.push(`t.trader_org_id = $${params.push(user.org_id)}`);
      } else if (user.role === 'finance_partner') {
        conditions.push(`(t.fp_org_id = $${params.push(user.org_id)} OR t.stage = 'FINANCE_REVIEW')`);
      }

      if (stage) {
        const stages = Array.isArray(stage) ? stage : stage.split(',');
        conditions.push(`t.stage = ANY($${params.push(stages)})`);
      }
      if (commodity)  conditions.push(`t.commodity = $${params.push(commodity)}`);
      if (from_date)  conditions.push(`t.applied_at >= $${params.push(from_date)}`);
      if (to_date)    conditions.push(`t.applied_at <= $${params.push(to_date)}`);

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

      const [rows, count] = await Promise.all([
        db.query(`SELECT t.id, t.trade_ref, t.commodity, t.grade, t.volume_mt,
                         t.price_per_mt_usd, t.contract_value_usd, t.finance_facility_usd,
                         t.stage, t.kyc_status, t.risk_score, t.capital_deployed_pct,
                         t.deadline_date, t.applied_at,
                         o.name AS trader_name, b.name AS buyer_name
                  FROM trades t
                  JOIN organisations o ON o.id = t.trader_org_id
                  JOIN buyers        b ON b.id = t.buyer_id
                  ${where}
                  ORDER BY t.applied_at DESC
                  LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`,
          params),
        db.query(`SELECT COUNT(*) FROM trades t ${where}`, params.slice(0, params.length - 2)),
      ]);

      res.json({ data: rows.rows, total: parseInt(count.rows[0].count), page: parseInt(page), per_page: limit });
    } catch (err) { next(err); }
  }
);

// ─── POST /trades ─────────────────────────────────────────────────────────────

router.post('/',
  requirePermission('trade.create'),
  idempotency,
  body('commodity').isIn(['cashew','shea','sesame','sorghum','soya']),
  body('grade').isIn(['A','B','C']),
  body('volume_mt').isFloat({ min: 1 }),
  body('buyer_id').isUUID(),
  body('price_per_mt_usd').isInt({ min: 1 }),       // cents
  body('procurement_cost_usd').isInt({ min: 1 }),   // cents
  body('trader_equity_usd').isInt({ min: 0 }),      // cents
  body('finance_facility_usd').isInt({ min: 0 }),   // cents
  body('delivery_point').isLength({ min: 3 }),
  body('deadline_date').isISO8601(),
  body('payment_terms_days').isInt({ min: 1 }),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { db, user } = req;
      const data = deserialiseMonetary(req.body); // converts cents → USD decimal

      // Equity minimum check
      if (data.trader_equity_usd < data.procurement_cost_usd * 0.35) {
        return res.status(422).json({
          error: 'EQUITY_BELOW_MINIMUM',
          message: 'Trader equity must be at least 35% of procurement cost.',
          minimum_required: Math.ceil(data.procurement_cost_usd * 0.35 * 100), // back to cents for client
        });
      }

      // Facility + equity must cover procurement cost (within $1)
      if (Math.abs((data.trader_equity_usd + data.finance_facility_usd) - data.procurement_cost_usd) > 1) {
        return res.status(422).json({
          error: 'FACILITY_MISMATCH',
          message: 'Trader equity + finance facility must equal procurement cost.',
        });
      }

      const result = await db.query(`
        INSERT INTO trades
          (trader_org_id, buyer_id, commodity, grade, volume_mt,
           price_per_mt_usd, procurement_cost_usd, trader_equity_usd, finance_facility_usd,
           delivery_point, deadline_date, payment_terms_days)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *`,
        [user.org_id, data.buyer_id, data.commodity, data.grade, data.volume_mt,
         data.price_per_mt_usd, data.procurement_cost_usd, data.trader_equity_usd,
         data.finance_facility_usd, data.delivery_point, data.deadline_date, data.payment_terms_days]
      );

      const trade = result.rows[0];

      // Create empty validation checklist
      await db.query('INSERT INTO trade_validations (trade_id) VALUES ($1)', [trade.id]);
      // Create empty closure checklist
      await db.query('INSERT INTO trade_closure_checklists (trade_id) VALUES ($1)', [trade.id]);

      // Set current_user_id for stage log trigger
      await db.query(`SET LOCAL app.current_user_id = '${user.id}'`);

      await auditLog(db, {
        userId: user.id, tradeId: trade.id, action: 'TRADE_SUBMITTED',
        entityType: 'trade', entityId: trade.id,
        newValue: { trade_ref: trade.trade_ref }, ipAddress: req.ip,
      });

      res.status(201).json(trade);
    } catch (err) { next(err); }
  }
);

// ─── GET /trades/:id ──────────────────────────────────────────────────────────

router.get('/:id',
  param('id').isUUID(),
  requirePermission('trade.view'),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { db, user } = req;
      const trade = await fetchTrade(db, req.params.id);
      if (!trade) return res.status(404).json({ error: 'NOT_FOUND' });

      if (!checkOwnership(user.role, 'trades', user, trade)) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }

      res.json(trade);
    } catch (err) { next(err); }
  }
);

// ─── PATCH /trades/:id/stage ──────────────────────────────────────────────────

router.patch('/:id/stage',
  param('id').isUUID(),
  body('stage').isString(),
  requirePermission('trade.advance_stage'),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { db, user } = req;
      const trade = await fetchTrade(db, req.params.id);
      if (!trade) return res.status(404).json({ error: 'NOT_FOUND' });

      const proposedStage = req.body.stage;

      // Build guards from current trade state
      const [valResult, fpResult] = await Promise.all([
        db.query('SELECT * FROM trade_validations WHERE trade_id=$1', [trade.id]),
        db.query('SELECT * FROM fp_decisions WHERE trade_id=$1 AND decision=$2', [trade.id, 'approve']),
      ]);

      const val = valResult.rows[0] || {};
      const guards = {
        validationComplete: val.buyer_verified && val.price_reasonable && val.sourcing_feasible && val.trader_qualified && val.margin_viable,
        fpApproved:         fpResult.rows.length > 0,
        escrowFunded:       !!trade.escrow_id,
        buyerPaid:          !!trade.buyer_payment_usd,
      };

      const { allowed, reason } = validateStageTransition(trade.stage, proposedStage, guards);
      if (!allowed) {
        return res.status(409).json({ error: 'STAGE_TRANSITION_NOT_ALLOWED', message: reason });
      }

      await db.query(`SET LOCAL app.current_user_id = '${user.id}'`);
      const updated = await db.query(
        `UPDATE trades SET stage=$1, updated_at=NOW(),
          validated_at = CASE WHEN $1='VALIDATED' THEN NOW() ELSE validated_at END,
          funded_at    = CASE WHEN $1='FUNDED'    THEN NOW() ELSE funded_at    END,
          delivered_at = CASE WHEN $1='DELIVERED' THEN NOW() ELSE delivered_at END
         WHERE id=$2 RETURNING *`,
        [proposedStage, trade.id]
      );

      await auditLog(db, {
        userId: user.id, tradeId: trade.id, action: 'STAGE_ADVANCED',
        entityType: 'trade', entityId: trade.id,
        oldValue: { stage: trade.stage }, newValue: { stage: proposedStage }, ipAddress: req.ip,
      });

      res.json(updated.rows[0]);
    } catch (err) { next(err); }
  }
);

// ─── POST /trades/:id/decline ─────────────────────────────────────────────────

router.post('/:id/decline',
  param('id').isUUID(),
  body('reason').isLength({ min: 10 }),
  requirePermission('trade.decline'),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { db, user } = req;
      const trade = await fetchTrade(db, req.params.id);
      if (!trade) return res.status(404).json({ error: 'NOT_FOUND' });
      if (!isTradeEditable(trade.stage)) {
        return res.status(409).json({ error: 'TRADE_NOT_EDITABLE', message: 'Trade cannot be declined at this stage.' });
      }

      const updated = await db.query(
        `UPDATE trades SET declined_at=NOW(), declined_by=$1, decline_reason=$2,
          stage='SUBMITTED', updated_at=NOW() WHERE id=$3 RETURNING *`,
        [user.id, req.body.reason, trade.id]
      );

      // Queue notification to trader
      await db.query(
        `INSERT INTO notifications (user_id, trade_id, channel, subject, body)
         SELECT u.id, $1, 'email',
           'Trade application update: ' || $2,
           'Your application ' || $2 || ' has been reviewed. ' || $3 || ' Please contact your Deal Officer for next steps.'
         FROM users u WHERE u.org_id = $4 AND u.role = 'trader' LIMIT 1`,
        [trade.id, trade.trade_ref, req.body.reason, trade.trader_org_id]
      );

      await auditLog(db, {
        userId: user.id, tradeId: trade.id, action: 'TRADE_DECLINED',
        entityType: 'trade', entityId: trade.id,
        newValue: { reason: req.body.reason }, ipAddress: req.ip,
      });

      res.json(updated.rows[0]);
    } catch (err) { next(err); }
  }
);

module.exports = router;
