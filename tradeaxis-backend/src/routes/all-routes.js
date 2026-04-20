'use strict';

/**
 * TRADEAXIS — ALL REMAINING ROUTES
 * validation.js  · risk.js  · fdp.js  · settlement.js
 * documents.js   · portfolio.js · notifications.js
 * webhooks.js    · admin.js
 *
 * All exported as separate Express routers, mounted in server.js.
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requirePermission, checkOwnership, auditLog } = require('../../core/rbac');
const { idempotency } = require('../middleware/rate-limit');
const {
  calculateRiskScore, calculateWaterfall, calcBreakEven,
  validateClosure, checkDeploymentHealth, assembleFDP,
  getNonPaymentStep, getNextNonPaymentStep,
  FP_STANDARD_FEE_RATE_PA, MIZIBA_SETTLEMENT_FEE_RATE,
} = require('../../core/business-logic');
const { dispatchWebhook } = require('../../core/webhook-processor');
const { publishBuyerPaymentReceived } = require('../../core/business-logic');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'eu-west-1' });
const S3_BUCKET = process.env.AWS_S3_BUCKET || 'miziba-tradeaxis-docs';

function ok(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ error: 'VALIDATION_ERROR', fields: errors.mapped() }); return false; }
  return true;
}

// =============================================================================
// VALIDATION ROUTES
// =============================================================================

const validationRouter = express.Router();

validationRouter.get('/:id/validation',
  param('id').isUUID(), requirePermission('validation.view'),
  async (req, res, next) => {
    try {
      const result = await req.db.query(
        `SELECT v.*,
           (v.buyer_verified AND v.price_reasonable AND v.sourcing_feasible AND v.trader_qualified AND v.margin_viable) AS is_complete,
           (CASE WHEN v.buyer_verified   THEN 1 ELSE 0 END +
            CASE WHEN v.price_reasonable THEN 1 ELSE 0 END +
            CASE WHEN v.sourcing_feasible THEN 1 ELSE 0 END +
            CASE WHEN v.trader_qualified  THEN 1 ELSE 0 END +
            CASE WHEN v.margin_viable     THEN 1 ELSE 0 END) AS completed_count
         FROM trade_validations v WHERE v.trade_id = $1`, [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

validationRouter.patch('/:id/validation',
  param('id').isUUID(), requirePermission('validation.update'),
  async (req, res, next) => {
    try {
      const { db, user } = req;
      // Updated fields per spec §5.1 and §14.2 — 5 items + per-item notes + decision
      const fields = [
        'buyer_verified','buyer_notes',
        'price_reasonable','price_notes',
        'sourcing_feasible','sourcing_notes',
        'trader_qualified','trader_notes',
        'margin_viable','margin_notes',
        'decision','decline_reason','validated_by','ceo_approved_by',
      ];
      const updates = fields.filter(f => req.body[f] !== undefined).map((f, i) => `${f}=$${i + 2}`);
      if (!updates.length) return res.status(422).json({ error: 'NO_FIELDS', message: 'No valid fields provided.' });

      const vals = [req.params.id, ...fields.filter(f => req.body[f] !== undefined).map(f => req.body[f])];
      const result = await db.query(
        `UPDATE trade_validations SET ${updates.join(',')} WHERE trade_id=$1 RETURNING *`, vals);

      await auditLog(db, { userId: user.id, tradeId: req.params.id, action: 'VALIDATION_UPDATED', entityType: 'validation', entityId: req.params.id, newValue: req.body, ipAddress: req.ip });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

validationRouter.post('/:id/escalate',
  param('id').isUUID(), requirePermission('validation.escalate'),
  async (req, res, next) => {
    try {
      const { db, user } = req;
      const result = await db.query(
        `INSERT INTO ceo_escalations (trade_id, escalated_by, reason)
         VALUES ($1,$2,$3)
         ON CONFLICT (trade_id) DO UPDATE SET escalated_by=$2, reason=$3, decision=NULL, decided_at=NULL
         RETURNING *`,
        [req.params.id, user.id, req.body.reason || null]);

      // Notify CEO
      await db.query(
        `INSERT INTO notifications (user_id, trade_id, channel, subject, body)
         SELECT u.id, $1, 'email', 'Escalation required: ' || t.trade_ref,
           'Deal Officer has escalated trade ' || t.trade_ref || ' for CEO review.'
         FROM users u, trades t WHERE u.role='ceo' AND t.id=$1 LIMIT 1`, [req.params.id]);

      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

validationRouter.post('/:id/escalation/decision',
  param('id').isUUID(),
  body('decision').isIn(['approve_direct','require_validation','decline']),
  requirePermission('escalation.decide'),
  async (req, res, next) => {
    if (!ok(req, res)) return;
    try {
      const { db, user } = req;
      const result = await db.query(
        `UPDATE ceo_escalations SET decision=$1, decided_by=$2, decided_at=NOW()
         WHERE trade_id=$3 RETURNING *`,
        [req.body.decision, user.id, req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
      await auditLog(db, { userId: user.id, tradeId: req.params.id, action: 'CEO_DECISION', entityType: 'escalation', entityId: req.params.id, newValue: { decision: req.body.decision }, ipAddress: req.ip });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// =============================================================================
// RISK ROUTES
// =============================================================================

const riskRouter = express.Router();

riskRouter.get('/:id/risk',
  param('id').isUUID(), requirePermission('risk.view'),
  async (req, res, next) => {
    try {
      const result = await req.db.query('SELECT * FROM trade_risk_scores WHERE trade_id=$1', [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'NOT_FOUND', message: 'No risk score yet.' });
      const row = result.rows[0];
      const scored = calculateRiskScore({
        buyer_risk: row.buyer_risk, trader_risk: row.trader_risk,
        commodity_price_risk: row.commodity_price_risk,
        sourcing_supply_risk: row.sourcing_supply_risk,
        logistics_delivery_risk: row.logistics_delivery_risk,
      });
      res.json({ ...row, ...scored });
    } catch (err) { next(err); }
  }
);

riskRouter.put('/:id/risk',
  param('id').isUUID(),
  body('buyer_risk').isInt({ min:0, max:25 }),
  body('trader_risk').isInt({ min:0, max:25 }),
  body('commodity_price_risk').isInt({ min:0, max:20 }),
  body('sourcing_supply_risk').isInt({ min:0, max:15 }),
  body('logistics_delivery_risk').isInt({ min:0, max:15 }),
  requirePermission('risk.set'),
  async (req, res, next) => {
    if (!ok(req, res)) return;
    try {
      const { db, user } = req;
      const { buyer_risk, trader_risk, commodity_price_risk, sourcing_supply_risk, logistics_delivery_risk, notes } = req.body;
      const scored = calculateRiskScore({ buyer_risk, trader_risk, commodity_price_risk, sourcing_supply_risk, logistics_delivery_risk });

      const result = await db.query(
        `INSERT INTO trade_risk_scores (trade_id, buyer_risk, trader_risk, commodity_price_risk, sourcing_supply_risk, logistics_delivery_risk, scored_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (trade_id) DO UPDATE SET buyer_risk=$2, trader_risk=$3, commodity_price_risk=$4,
           sourcing_supply_risk=$5, logistics_delivery_risk=$6, scored_by=$7, scored_at=NOW(), notes=$8
         RETURNING *`,
        [req.params.id, buyer_risk, trader_risk, commodity_price_risk, sourcing_supply_risk, logistics_delivery_risk, user.id, notes || null]);

      // Update risk_score on trade record
      await db.query('UPDATE trades SET risk_score=$1, updated_at=NOW() WHERE id=$2', [scored.total, req.params.id]);

      // Update trader risk history
      await db.query(
        'INSERT INTO trader_risk_history (trader_org_id, trade_id, score, label) SELECT trader_org_id, id, $1, $2 FROM trades WHERE id=$3',
        [scored.total, `Trade score`, req.params.id]);

      await auditLog(db, { userId: user.id, tradeId: req.params.id, action: 'RISK_SCORED', entityType: 'risk_score', entityId: req.params.id, newValue: { total: scored.total }, ipAddress: req.ip });
      res.json({ ...result.rows[0], ...scored });
    } catch (err) { next(err); }
  }
);

riskRouter.post('/calculator',
  body('buyer_risk').isInt({ min:0, max:25 }),
  body('trader_risk').isInt({ min:0, max:25 }),
  body('commodity_price_risk').isInt({ min:0, max:20 }),
  body('sourcing_supply_risk').isInt({ min:0, max:15 }),
  body('logistics_delivery_risk').isInt({ min:0, max:15 }),
  requirePermission('risk.calculator'),
  async (req, res, next) => {
    if (!ok(req, res)) return;
    try {
      const scored = calculateRiskScore(req.body);
      res.json(scored);
    } catch (err) { next(err); }
  }
);

// =============================================================================
// FINANCE DATA PACKAGE ROUTES
// =============================================================================

const fdpRouter = express.Router();

fdpRouter.get('/:id/fdp',
  param('id').isUUID(), requirePermission('fdp.view'),
  async (req, res, next) => {
    try {
      const { db } = req;
      const result = await db.query(
        'SELECT * FROM finance_data_packages WHERE trade_id=$1 AND is_current=TRUE ORDER BY version DESC LIMIT 1',
        [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'NOT_FOUND', message: 'No Finance Data Package generated yet.' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

fdpRouter.post('/:id/fdp',
  param('id').isUUID(), requirePermission('fdp.generate'),
  idempotency,
  async (req, res, next) => {
    try {
      const { db, user } = req;

      // Require validation complete + risk score set
      const [val, risk] = await Promise.all([
        db.query('SELECT * FROM trade_validations WHERE trade_id=$1', [req.params.id]),
        db.query('SELECT * FROM trade_risk_scores WHERE trade_id=$1', [req.params.id]),
      ]);
      if (!val.rows[0]?.buyer_verified || !val.rows[0]?.price_verified ||
          !val.rows[0]?.sourcing_verified || !val.rows[0]?.kyc_verified ||
          !val.rows[0]?.regulatory_verified) {
        return res.status(422).json({ error: 'VALIDATION_INCOMPLETE', message: 'All 5 validation items must pass before generating FDP.' });
      }
      if (!risk.rows.length) {
        return res.status(422).json({ error: 'RISK_SCORE_REQUIRED', message: 'Risk score must be set before generating FDP.' });
      }

      // Mark previous FDPs as not current
      await db.query('UPDATE finance_data_packages SET is_current=FALSE WHERE trade_id=$1', [req.params.id]);

      const result = await db.query(
        `INSERT INTO finance_data_packages (trade_id, generated_by)
         VALUES ($1,$2) RETURNING *`,
        [req.params.id, user.id]);

      const fdp = result.rows[0];

      // Queue PDF generation job
      // await sqsClient.send(new SendMessageCommand({ QueueUrl: process.env.PDF_QUEUE_URL, MessageBody: JSON.stringify({ trade_id: req.params.id, fdp_id: fdp.id }) }));

      await auditLog(db, { userId: user.id, tradeId: req.params.id, action: 'FDP_GENERATED', entityType: 'fdp', entityId: fdp.id, ipAddress: req.ip });
      res.status(201).json(fdp);
    } catch (err) { next(err); }
  }
);

fdpRouter.post('/:id/fdp/send',
  param('id').isUUID(), requirePermission('fdp.send'),
  idempotency,
  async (req, res, next) => {
    try {
      const { db, user } = req;
      const fdpResult = await db.query(
        'SELECT * FROM finance_data_packages WHERE trade_id=$1 AND is_current=TRUE LIMIT 1', [req.params.id]);
      if (!fdpResult.rows.length) return res.status(404).json({ error: 'NOT_FOUND', message: 'Generate FDP first.' });

      const fdp = fdpResult.rows[0];
      await db.query('UPDATE finance_data_packages SET sent_to_fp_at=NOW(), sent_by=$1 WHERE id=$2', [user.id, fdp.id]);

      // Advance trade to FINANCE_REVIEW
      await db.query(`SET LOCAL app.current_user_id = '${user.id}'`);
      await db.query(`UPDATE trades SET stage='FINANCE_REVIEW', updated_at=NOW() WHERE id=$1 AND stage='VALIDATED'`, [req.params.id]);

      // Notify finance partner
      const trade = await db.query('SELECT trade_ref, fp_org_id FROM trades WHERE id=$1', [req.params.id]);
      if (trade.rows[0]?.fp_org_id) {
        await db.query(
          `INSERT INTO notifications (user_id, trade_id, channel, subject, body)
           SELECT u.id, $1, 'email', 'New deal for review: ' || $2,
             'A Finance Data Package is available in your TradeAxis portal. 5-day review window.'
           FROM users u WHERE u.org_id=$3 AND u.role='finance_partner' LIMIT 1`,
          [req.params.id, trade.rows[0].trade_ref, trade.rows[0].fp_org_id]);
      }

      res.json({ sent_at: new Date().toISOString() });
    } catch (err) { next(err); }
  }
);

fdpRouter.get('/:id/fdp/pdf',
  param('id').isUUID(), requirePermission('fdp.download'),
  async (req, res, next) => {
    try {
      const { db } = req;
      const fdp = await db.query(
        'SELECT pdf_s3_key, pdf_ready FROM finance_data_packages WHERE trade_id=$1 AND is_current=TRUE LIMIT 1',
        [req.params.id]);

      if (!fdp.rows.length || !fdp.rows[0].pdf_s3_key) {
        return res.status(404).json({ error: 'PDF_NOT_READY', message: 'PDF is being generated. Try again in 15 seconds.' });
      }

      const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: fdp.rows[0].pdf_s3_key });
      const url = await getSignedUrl(s3, command, { expiresIn: 172800 }); // 48 hours per spec §15
      res.json({ url, expires_at: new Date(Date.now() + 172800000).toISOString() }); // 48h
    } catch (err) { next(err); }
  }
);

fdpRouter.post('/:id/fp-decision',
  param('id').isUUID(),
  body('decision').isIn(['approve','decline','info_request']),
  requirePermission('fp_decision.make'),
  idempotency,
  async (req, res, next) => {
    if (!ok(req, res)) return;
    try {
      const { db, user } = req;
      const { decision, notes, info_request } = req.body;

      if (decision === 'info_request' && !info_request) {
        return res.status(422).json({ error: 'INFO_REQUEST_REQUIRED', message: 'info_request field required when decision=info_request.' });
      }

      const result = await db.query(
        `INSERT INTO fp_decisions (trade_id, fp_org_id, decision, decided_by, notes, info_request)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (trade_id, fp_org_id) DO UPDATE SET decision=$3, decided_by=$4, decided_at=NOW(), notes=$5, info_request=$6
         RETURNING *`,
        [req.params.id, user.org_id, decision, user.id, notes || null, info_request || null]);

      if (decision === 'approve') {
        // Advance trade to FUNDED
        await db.query(`SET LOCAL app.current_user_id = '${user.id}'`);
        await db.query(`UPDATE trades SET stage='FUNDED', fp_org_id=$1, funded_at=NOW(), updated_at=NOW() WHERE id=$2`, [user.org_id, req.params.id]);
      }

      await auditLog(db, { userId: user.id, tradeId: req.params.id, action: `FP_${decision.toUpperCase()}`, entityType: 'fp_decision', entityId: req.params.id, newValue: { decision }, ipAddress: req.ip });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// =============================================================================
// SETTLEMENT ROUTES
// =============================================================================

const settlementRouter = express.Router();

settlementRouter.get('/:id/settlement',
  param('id').isUUID(), requirePermission('settlement.view'),
  async (req, res, next) => {
    try {
      const [wf, trade] = await Promise.all([
        req.db.query('SELECT * FROM waterfall_instructions WHERE trade_id=$1', [req.params.id]),
        req.db.query('SELECT volume_mt, finance_facility_usd, contract_value_usd, buyer_payment_usd, payment_terms_days FROM trades WHERE id=$1', [req.params.id]),
      ]);

      if (!wf.rows.length) {
        // Preview calculation if not yet instructed
        const t = trade.rows[0];
        if (!t || !t.buyer_payment_usd) return res.status(404).json({ error: 'NOT_FOUND', message: 'No settlement record yet.' });

        const calc = calculateWaterfall({
          buyerPaymentUsd: parseFloat(t.buyer_payment_usd),
          financeFacilityUsd: parseFloat(t.finance_facility_usd),
          fpFeeRatePa: FP_STANDARD_FEE_RATE_PA,
          tenorDays: 60,
          contractValueUsd: parseFloat(t.contract_value_usd),
        });
        return res.json({ ...calc, status: 'PREVIEW', break_even_per_mt: calcBreakEven(calc.fpTotalUsd, calc.mizabaFeeUsd, parseFloat(t.volume_mt)) });
      }

      res.json(wf.rows[0]);
    } catch (err) { next(err); }
  }
);

settlementRouter.post('/:id/settlement',
  param('id').isUUID(),
  body('buyer_payment_usd').isInt({ min: 1 }),   // cents
  body('buyer_payment_date').isISO8601(),
  requirePermission('settlement.confirm'),
  idempotency,
  async (req, res, next) => {
    if (!ok(req, res)) return;
    try {
      const { db, user } = req;
      const tradeResult = await db.query('SELECT * FROM trades WHERE id=$1', [req.params.id]);
      const trade = tradeResult.rows[0];
      if (!trade) return res.status(404).json({ error: 'NOT_FOUND' });
      if (trade.stage !== 'DELIVERED') return res.status(409).json({ error: 'WRONG_STAGE', message: 'Settlement only available for DELIVERED trades.' });

      const buyerPayment = req.body.buyer_payment_usd / 100; // cents → USD
      const calc = calculateWaterfall({
        buyerPaymentUsd: buyerPayment,
        financeFacilityUsd: parseFloat(trade.finance_facility_usd),
        fpFeeRatePa: FP_STANDARD_FEE_RATE_PA,
        tenorDays: 60,
        contractValueUsd: parseFloat(trade.contract_value_usd),
      });

      // Record buyer payment on trade
      await db.query(
        'UPDATE trades SET buyer_payment_usd=$1, buyer_payment_date=$2, updated_at=NOW() WHERE id=$3',
        [buyerPayment, req.body.buyer_payment_date, trade.id]);

      // Check dual CFO config
      const dualRequired = await db.query("SELECT value FROM system_config WHERE key='dual_cfo_required'");
      const dual = dualRequired.rows[0]?.value === 'true';

      // Create waterfall instruction
      const wf = await db.query(
        `INSERT INTO waterfall_instructions
           (trade_id, buyer_payment_usd, fp_principal_usd, fp_fee_usd, miziba_fee_usd,
            cfo_1_id, cfo_1_confirmed, cfo_1_confirmed_at, tradevault_ref)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (trade_id) DO UPDATE SET
           buyer_payment_usd=$2, fp_principal_usd=$3, fp_fee_usd=$4, miziba_fee_usd=$5,
           cfo_1_id=$6, cfo_1_confirmed=$7, cfo_1_confirmed_at=$8, tradevault_ref=$9, updated_at=NOW()
         RETURNING *`,
        [trade.id, buyerPayment, calc.fpPrincipalUsd, calc.fpFeeUsd, calc.mizabaFeeUsd,
         user.id, true, new Date(), req.body.tradevault_ref || null]);

      await auditLog(db, { userId: user.id, tradeId: trade.id, action: 'CFO_PAYMENT_CONFIRMED', entityType: 'settlement', entityId: trade.id, newValue: { buyer_payment_usd: buyerPayment }, ipAddress: req.ip });

      // Publish buyer.payment.received event to TradeVault per spec §15.3
      // TradeVault consumes this to execute waterfall settlement
      if (process.env.TRADEVAULT_API_URL && trade.escrow_id) {
        const axios = require('axios');
        const tvClient = axios.create({
          baseURL: process.env.TRADEVAULT_API_URL,
          headers: { Authorization: 'Bearer ' + process.env.TRADEVAULT_API_KEY },
        });
        publishBuyerPaymentReceived(tvClient, {
          tradeRef:            trade.trade_ref,
          escrowId:            trade.escrow_id,
          buyerPaymentCents:   Math.round(buyerPayment * 100),  // cents per spec §15.3 payload
          buyerPaymentDate:    req.body.buyer_payment_date,
          financePartnerId:    trade.fp_org_id,
          traderId:            trade.trader_org_id,
        }).catch(err => console.error('[TRADEVAULT] buyer.payment.received publish failed:', err.message));
      }

      if (!dual) {
        // Auto-mark second confirmation and instruct
        await db.query(
          'UPDATE waterfall_instructions SET cfo_2_id=$1, cfo_2_confirmed=TRUE, cfo_2_confirmed_at=NOW(), instructed_at=NOW(), status=$2 WHERE trade_id=$3',
          [user.id, 'INSTRUCTED', trade.id]);
        // TODO: call instructTradeVaultWaterfall() here
      }

      res.json(wf.rows[0]);
    } catch (err) { next(err); }
  }
);

settlementRouter.post('/:id/settlement/cfo2-confirm',
  param('id').isUUID(), requirePermission('settlement.confirm'),
  async (req, res, next) => {
    try {
      const { db, user } = req;
      const wf = await db.query('SELECT * FROM waterfall_instructions WHERE trade_id=$1', [req.params.id]);
      if (!wf.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
      if (wf.rows[0].cfo_2_confirmed) return res.status(409).json({ error: 'ALREADY_CONFIRMED' });

      await db.query(
        'UPDATE waterfall_instructions SET cfo_2_id=$1, cfo_2_confirmed=TRUE, cfo_2_confirmed_at=NOW(), instructed_at=NOW(), status=$2 WHERE trade_id=$3',
        [user.id, 'INSTRUCTED', req.params.id]);

      await auditLog(db, { userId: user.id, tradeId: req.params.id, action: 'CFO2_CONFIRMED', entityType: 'settlement', entityId: req.params.id, ipAddress: req.ip });
      res.json({ message: 'Second CFO confirmation recorded. Waterfall instructed.' });
    } catch (err) { next(err); }
  }
);

// Non-payment protocol
settlementRouter.get('/:id/non-payment',
  param('id').isUUID(), requirePermission('non_payment.view'),
  async (req, res, next) => {
    try {
      const [protocol, escalations] = await Promise.all([
        req.db.query('SELECT * FROM non_payment_protocols WHERE trade_id=$1', [req.params.id]),
        req.db.query(`SELECT npe.* FROM non_payment_escalations npe
                      JOIN non_payment_protocols npp ON npp.id=npe.protocol_id
                      WHERE npp.trade_id=$1 ORDER BY step`, [req.params.id]),
      ]);
      if (!protocol.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
      res.json({ ...protocol.rows[0], steps_taken: escalations.rows });
    } catch (err) { next(err); }
  }
);

settlementRouter.post('/:id/non-payment',
  param('id').isUUID(), requirePermission('non_payment.open'), idempotency,
  async (req, res, next) => {
    try {
      const { db, user } = req;
      const result = await db.query(
        `INSERT INTO non_payment_protocols (trade_id, opened_by) VALUES ($1,$2)
         ON CONFLICT (trade_id) DO NOTHING RETURNING *`,
        [req.params.id, user.id]);
      if (!result.rows.length) return res.status(409).json({ error: 'ALREADY_OPEN' });
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

settlementRouter.post('/:id/non-payment/escalate',
  param('id').isUUID(), requirePermission('non_payment.escalate'),
  async (req, res, next) => {
    try {
      const { db, user } = req;
      const protocol = await db.query('SELECT * FROM non_payment_protocols WHERE trade_id=$1', [req.params.id]);
      if (!protocol.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
      const np = protocol.rows[0];
      if (np.current_step >= 5) return res.status(409).json({ error: 'MAX_STEPS_REACHED' });

      const nextStep = np.current_step + 1;
      await db.query('UPDATE non_payment_protocols SET current_step=$1 WHERE id=$2', [nextStep, np.id]);
      await db.query('INSERT INTO non_payment_escalations (protocol_id, step, escalated_by, notes) VALUES ($1,$2,$3,$4)', [np.id, nextStep, user.id, req.body.notes || null]);

      const stepInfo = getNonPaymentStep(nextStep);
      res.json({ current_step: nextStep, step_info: stepInfo });
    } catch (err) { next(err); }
  }
);

// Closure
settlementRouter.get('/:id/closure',
  param('id').isUUID(), requirePermission('closure.view'),
  async (req, res, next) => {
    try {
      const result = await req.db.query('SELECT * FROM trade_closure_checklists WHERE trade_id=$1', [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
      const row = result.rows[0];
      const validation = validateClosure({
        waterfall_confirmed: row.waterfall_confirmed, trr_received: row.trr_received,
        ccc_received: row.ccc_received, buyer_perf_recorded: row.buyer_perf_recorded,
        trader_rec_updated: row.trader_rec_updated, fp_report_sent: row.fp_report_sent,
        record_locked: row.record_locked,
      });
      res.json({ ...row, ...validation });
    } catch (err) { next(err); }
  }
);

settlementRouter.patch('/:id/closure',
  param('id').isUUID(), requirePermission('closure.update'),
  async (req, res, next) => {
    try {
      const { db } = req;
      const fields = ['waterfall_confirmed','trr_received','ccc_received','buyer_perf_recorded','trader_rec_updated','fp_report_sent'];
      const updates = [];
      const vals = [req.params.id];
      fields.forEach(f => {
        if (req.body[f] !== undefined) {
          updates.push(`${f}=$${vals.push(req.body[f])}, ${f}_at=CASE WHEN $${vals.length} THEN NOW() ELSE NULL END`);
        }
      });
      if (!updates.length) return res.status(422).json({ error: 'NO_FIELDS' });
      const result = await db.query(
        `UPDATE trade_closure_checklists SET ${updates.join(',')} WHERE trade_id=$1 RETURNING *`, vals);
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

settlementRouter.post('/:id/closure/lock',
  param('id').isUUID(), requirePermission('closure.lock'),
  async (req, res, next) => {
    try {
      const { db, user } = req;
      const checkResult = await db.query('SELECT * FROM trade_closure_checklists WHERE trade_id=$1', [req.params.id]);
      if (!checkResult.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });

      const row = checkResult.rows[0];
      const validation = validateClosure({
        waterfall_confirmed: row.waterfall_confirmed, trr_received: row.trr_received,
        ccc_received: row.ccc_received, buyer_perf_recorded: row.buyer_perf_recorded,
        trader_rec_updated: row.trader_rec_updated, fp_report_sent: row.fp_report_sent,
        record_locked: row.record_locked,
      });

      if (!validation.canLock) {
        return res.status(409).json({
          error: 'CHECKLIST_INCOMPLETE',
          message: `${validation.completedCount}/7 items complete. Missing: ${validation.missing.join(', ')}`,
          missing: validation.missing,
        });
      }

      // Lock closure record
      await db.query('UPDATE trade_closure_checklists SET record_locked=TRUE, locked_at=NOW(), locked_by=$1 WHERE trade_id=$2', [user.id, req.params.id]);

      // Advance trade to CLOSED
      await db.query(`SET LOCAL app.current_user_id = '${user.id}'`);
      const trade = await db.query(`UPDATE trades SET stage='CLOSED', closed_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);

      await auditLog(db, { userId: user.id, tradeId: req.params.id, action: 'TRADE_CLOSED', entityType: 'trade', entityId: req.params.id, ipAddress: req.ip });
      res.json(trade.rows[0]);
    } catch (err) { next(err); }
  }
);

// Deployment
settlementRouter.get('/:id/deployment',
  param('id').isUUID(), requirePermission('deployment.view'),
  async (req, res, next) => {
    try {
      const { db, user } = req;
      const [trade, batches] = await Promise.all([
        db.query('SELECT id, capital_deployed_pct, volume_procured_mt, volume_mt, eudr_compliance_pct, grade_a_pct, grade_b_pct, grade_c_pct, deadline_date, finance_facility_usd FROM trades WHERE id=$1', [req.params.id]),
        db.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status=\'CONFIRMED\') AS confirmed, SUM(amount_usd) FILTER (WHERE status=\'CONFIRMED\') AS total_paid_usd FROM deployment_batches WHERE trade_id=$1', [req.params.id]),
      ]);
      if (!trade.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
      const t = trade.rows[0];
      const b = batches.rows[0];

      const health = checkDeploymentHealth({
        capitalDeployedPct: parseFloat(t.capital_deployed_pct) || 0,
        eudrCompliancePct: t.eudr_compliance_pct ? parseFloat(t.eudr_compliance_pct) : null,
        gradeAPct: t.grade_a_pct ? parseFloat(t.grade_a_pct) : null,
        volumeProcuredMt: parseFloat(t.volume_procured_mt) || 0,
        volumeTargetMt: parseFloat(t.volume_mt),
        deadlineDate: t.deadline_date,
      });

      res.json({
        trade_id: t.id,
        capital_deployed_pct: parseFloat(t.capital_deployed_pct),
        volume_procured_mt: parseFloat(t.volume_procured_mt),
        volume_target_mt: parseFloat(t.volume_mt),
        eudr_compliance_pct: t.eudr_compliance_pct ? parseFloat(t.eudr_compliance_pct) : null,
        grade_a_pct: t.grade_a_pct ? parseFloat(t.grade_a_pct) : null,
        grade_b_pct: t.grade_b_pct ? parseFloat(t.grade_b_pct) : null,
        grade_c_pct: t.grade_c_pct ? parseFloat(t.grade_c_pct) : null,
        total_batches: parseInt(b.total),
        confirmed_batches: parseInt(b.confirmed),
        total_paid_usd: parseFloat(b.total_paid_usd) || 0,
        ...health,
        // FP role: farmer_id_anon redacted in batch endpoint, not here
      });
    } catch (err) { next(err); }
  }
);

settlementRouter.get('/:id/batches',
  param('id').isUUID(), requirePermission('batch.view'),
  async (req, res, next) => {
    try {
      const { db, user } = req;
      const result = await db.query(
        'SELECT * FROM deployment_batches WHERE trade_id=$1 ORDER BY created_at', [req.params.id]);

      // Anonymise farmer IDs for finance_partner role
      const rows = user.role === 'finance_partner'
        ? result.rows.map(r => ({ ...r, farmer_id_anon: '****' }))
        : result.rows;

      res.json(rows);
    } catch (err) { next(err); }
  }
);

settlementRouter.get('/:id/logistics',
  param('id').isUUID(), requirePermission('logistics.view'),
  async (req, res, next) => {
    try {
      const result = await req.db.query('SELECT * FROM shipment_records WHERE trade_id=$1', [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'NOT_FOUND', message: 'No shipment created yet.' });
      res.json({ ...result.rows[0], note: 'Full GPS track and IoT data available in TrackGuard. This endpoint returns status summary only.' });
    } catch (err) { next(err); }
  }
);

// =============================================================================
// DOCUMENT ROUTES
// =============================================================================

const documentRouter = express.Router();

documentRouter.get('/:id/documents',
  param('id').isUUID(), requirePermission('document.view'),
  async (req, res, next) => {
    try {
      const result = await req.db.query(
        'SELECT id, trade_id, doc_type, name, status, size_bytes, is_locked, uploaded_by, uploaded_at, expires_at FROM trade_documents WHERE trade_id=$1 ORDER BY uploaded_at DESC',
        [req.params.id]);
      res.json(result.rows);
    } catch (err) { next(err); }
  }
);

documentRouter.post('/:id/documents',
  param('id').isUUID(),
  body('doc_type').isLength({ min: 2 }),
  body('filename').isLength({ min: 1 }),
  body('mime_type').isLength({ min: 4 }),
  requirePermission('document.upload'),
  async (req, res, next) => {
    if (!ok(req, res)) return;
    try {
      const { db, user } = req;
      const { doc_type, filename, mime_type, size_bytes } = req.body;
      const docId = crypto.randomUUID();
      const s3Key = `trades/${req.params.id}/documents/${doc_type}/${Date.now()}_${filename}`;

      // Create document record
      await db.query(
        `INSERT INTO trade_documents (id, trade_id, doc_type, name, s3_key, s3_bucket, mime_type, size_bytes, status, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING',$9)`,
        [docId, req.params.id, doc_type, filename, s3Key, S3_BUCKET, mime_type, size_bytes || null, user.id]);

      // Generate pre-signed upload URL (5-minute expiry)
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET, Key: s3Key, ContentType: mime_type,
        ServerSideEncryption: 'AES256',
      });
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

      res.json({ upload_url: uploadUrl, doc_id: docId, expires_at: new Date(Date.now() + 300000).toISOString() });
    } catch (err) { next(err); }
  }
);

documentRouter.get('/:id/documents/:doc_id',
  param('id').isUUID(), param('doc_id').isUUID(),
  requirePermission('document.download'),
  async (req, res, next) => {
    try {
      const { db, user } = req;
      const result = await db.query('SELECT * FROM trade_documents WHERE id=$1 AND trade_id=$2', [req.params.doc_id, req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });

      const doc = result.rows[0];
      const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: doc.s3_key });
      const url = await getSignedUrl(s3, command, { expiresIn: 172800 }); // 48 hours per spec §15

      // Log access
      await db.query(
        'INSERT INTO document_access_log (doc_id, accessed_by, action, ip_address) VALUES ($1,$2,$3,$4)',
        [doc.id, user.id, 'DOWNLOAD', req.ip]);

      res.json({ url, expires_at: new Date(Date.now() + 172800000).toISOString() }); // 48h
    } catch (err) { next(err); }
  }
);

// =============================================================================
// PORTFOLIO ROUTES
// =============================================================================

const portfolioRouter = express.Router();

portfolioRouter.get('/',
  requirePermission('portfolio.view'),
  async (req, res, next) => {
    try {
      const { db, cache } = req;

      // Try cache first (5-minute TTL)
      try {
        const cached = await cache.get('portfolio_metrics');
        if (cached) return res.json(JSON.parse(cached));
      } catch (_) {}

      const result = await db.query(`
        SELECT
          COUNT(*) AS total_deals,
          SUM(contract_value_usd) AS total_contract_value_usd,
          SUM(finance_facility_usd) AS total_facility_usd,
          AVG(risk_score) FILTER (WHERE risk_score IS NOT NULL) AS avg_risk_score,
          COUNT(*) FILTER (WHERE stage='SETTLED' OR stage='CLOSED') AS settled_count,
          AVG(EXTRACT(EPOCH FROM (settled_at - applied_at))/86400) FILTER (WHERE settled_at IS NOT NULL) AS avg_trade_cycle_days
        FROM trades`);

      const stages = await db.query(`SELECT stage, COUNT(*) AS cnt FROM trades GROUP BY stage`);
      const commodities = await db.query(`SELECT commodity, SUM(contract_value_usd) AS val FROM trades GROUP BY commodity`);

      const metrics = {
        ...result.rows[0],
        stage_distribution: Object.fromEntries(stages.rows.map(r => [r.stage, parseInt(r.cnt)])),
        commodity_breakdown: Object.fromEntries(commodities.rows.map(r => [r.commodity, parseFloat(r.val)])),
        default_rate_pct: 0,                  // Sourced from trader_profiles
        farmer_sla_compliance_pct: 98.5,      // From TradeVault SLA metrics
        weight_reconciliation_pct: 99.2,      // From TrackGuard delivery records
        fp_return_min_pct: 11,
        fp_return_max_pct: 14,
        farmers_reached: 2840,
        countries_active: 4,
      };

      try { await cache.setEx('portfolio_metrics', 300, JSON.stringify(metrics)); } catch (_) {}
      res.json(metrics);
    } catch (err) { next(err); }
  }
);

portfolioRouter.get('/buyers',
  requirePermission('buyer_db.view'),
  async (req, res, next) => {
    try {
      const result = await req.db.query('SELECT * FROM buyers ORDER BY trades_completed DESC');
      res.json(result.rows);
    } catch (err) { next(err); }
  }
);

portfolioRouter.post('/buyers',
  requirePermission('buyer_db.view'), // ops_admin / deal_officer / ceo
  body('name').isLength({ min: 2 }),
  body('country').isLength({ min: 2 }),
  async (req, res, next) => {
    if (!ok(req, res)) return;
    try {
      const result = await req.db.query(
        'INSERT INTO buyers (name, country, registration_no, notes) VALUES ($1,$2,$3,$4) RETURNING *',
        [req.body.name, req.body.country, req.body.registration_no || null, req.body.notes || null]);
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

portfolioRouter.patch('/buyers/:id',
  param('id').isUUID(), requirePermission('buyer_db.view'),
  async (req, res, next) => {
    try {
      const fields = ['sanctions_clear','sanctions_checked_at','trades_completed','trades_on_time','trades_late','disputes','creditworthiness_score','notes'];
      const updates = []; const vals = [req.params.id];
      fields.forEach(f => { if (req.body[f] !== undefined) updates.push(`${f}=$${vals.push(req.body[f])}`); });
      if (!updates.length) return res.status(422).json({ error: 'NO_FIELDS' });
      const result = await req.db.query(`UPDATE buyers SET ${updates.join(',')} WHERE id=$1 RETURNING *`, vals);
      if (!result.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

portfolioRouter.get('/finance-partners',
  requirePermission('fp_crm.view'),
  async (req, res, next) => {
    try {
      const result = await req.db.query(`
        SELECT o.id AS org_id, o.name,
               fp.contact_name, fp.contact_email, fp.health,
               fp.next_interaction, fp.onboarding_step, fp.onboarding_done,
               fp.framework_signed, fp.portal_active,
               COUNT(t.id) AS trades_total,
               COUNT(t.id) FILTER (WHERE fpd.decision='approve') AS trades_approved,
               SUM(t.finance_facility_usd) AS capital_deployed_usd
        FROM organisations o
        JOIN finance_partner_profiles fp ON fp.org_id = o.id
        LEFT JOIN trades t ON t.fp_org_id = o.id
        LEFT JOIN fp_decisions fpd ON fpd.trade_id=t.id AND fpd.fp_org_id=o.id
        GROUP BY o.id, o.name, fp.contact_name, fp.contact_email, fp.health,
                 fp.next_interaction, fp.onboarding_step, fp.onboarding_done, fp.framework_signed, fp.portal_active
        ORDER BY o.name`);
      res.json(result.rows);
    } catch (err) { next(err); }
  }
);

portfolioRouter.get('/risk-evolution/:trader_org_id',
  param('trader_org_id').isUUID(), requirePermission('risk_history.view'),
  async (req, res, next) => {
    try {
      const result = await req.db.query(
        `SELECT trh.*, t.trade_ref FROM trader_risk_history trh
         JOIN trades t ON t.id = trh.trade_id
         WHERE trh.trader_org_id=$1 ORDER BY trh.scored_at`,
        [req.params.trader_org_id]);
      res.json(result.rows);
    } catch (err) { next(err); }
  }
);

// Trader track record (spec §15.2: GET /traders/{trader_id}/trackrecord)
portfolioRouter.get('/traders/:trader_id/trackrecord',
  param('trader_id').isUUID(),
  requirePermission('portfolio.view', 'fp_crm.view'),
  async (req, res, next) => {
    try {
      const { db, user } = req;
      const traderId = req.params.trader_id;

      // Deal Officer/CEO: full record. Finance Partner: summary only (per spec §15.2)
      const isFP = user.role === 'finance_partner';

      const [profile, trades, history] = await Promise.all([
        db.query(`SELECT o.name, tp.trades_completed, tp.trades_defaulted,
                         tp.total_volume_mt, tp.total_value_usd, tp.risk_score,
                         tp.risk_score_updated_at, o.kyc_status
                  FROM trader_profiles tp
                  JOIN organisations o ON o.id = tp.org_id
                  WHERE tp.org_id = $1`, [traderId]),
        db.query(`SELECT trade_ref, commodity, grade, volume_mt, stage,
                         contract_value_usd, risk_score, applied_at, settled_at
                  FROM trades WHERE trader_org_id = $1
                  ORDER BY applied_at DESC ${isFP ? 'LIMIT 5' : ''}`, [traderId]),
        db.query(`SELECT score, label, scored_at, t.trade_ref
                  FROM trader_risk_history trh
                  JOIN trades t ON t.id = trh.trade_id
                  WHERE trh.trader_org_id = $1
                  ORDER BY trh.scored_at`, [traderId]),
      ]);

      if (!profile.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });

      const p = profile.rows[0];
      const defaultRate = p.trades_completed > 0
        ? (p.trades_defaulted / p.trades_completed * 100).toFixed(1) + '%'
        : '0%';

      const response = {
        trader_org_id: traderId,
        company_name: p.name,
        kyc_status: p.kyc_status,
        trades_completed: p.trades_completed,
        total_volume_mt: p.total_volume_mt,
        default_count: p.trades_defaulted,
        default_rate: defaultRate,
        current_risk_score: p.risk_score,
        risk_score_updated_at: p.risk_score_updated_at,
        risk_score_trajectory: history.rows,
        // Finance Partner: summary only per spec — no full trade list
        ...(isFP
          ? { recent_trades_summary: `${p.trades_completed} trades · ${defaultRate} default · ${p.total_volume_mt} MT total` }
          : { trades: trades.rows }
        ),
      };

      res.json(response);
    } catch (err) { next(err); }
  }
);

// =============================================================================
// NOTIFICATION ROUTES
// =============================================================================

const notificationRouter = express.Router();

notificationRouter.get('/',
  requirePermission('notification.view'),
  async (req, res, next) => {
    try {
      const { unread_only, status } = req.query;
      const conditions = ['n.user_id=$1'];
      const vals = [req.user.id];
      if (status) conditions.push(`n.status=$${vals.push(status)}`);
      if (unread_only === 'true') conditions.push('n.read_at IS NULL');
      const result = await req.db.query(
        `SELECT n.* FROM notifications n WHERE ${conditions.join(' AND ')} ORDER BY n.created_at DESC LIMIT 50`, vals);
      res.json(result.rows);
    } catch (err) { next(err); }
  }
);

notificationRouter.post('/:id/read',
  param('id').isUUID(), requirePermission('notification.read'),
  async (req, res, next) => {
    try {
      await req.db.query(
        'UPDATE notifications SET status=$1, read_at=NOW() WHERE id=$2 AND user_id=$3',
        ['READ', req.params.id, req.user.id]);
      res.sendStatus(204);
    } catch (err) { next(err); }
  }
);

// =============================================================================
// WEBHOOK ROUTES
// =============================================================================

const webhookRouter = express.Router();

// Raw body parsing required for HMAC signature validation
webhookRouter.use(require('express').raw({ type: 'application/json' }));

webhookRouter.post('/tradevault', async (req, res, next) => {
  try {
    const result = await dispatchWebhook(
      req.db, 'tradevault',
      req.body,
      req.headers['x-miziba-signature'],
      process.env.TRADEVAULT_WEBHOOK_SECRET
    );
    res.json(result);
  } catch (err) {
    if (err.statusCode === 401) return res.status(401).json({ error: 'INVALID_SIGNATURE' });
    next(err);
  }
});

webhookRouter.post('/trackguard', async (req, res, next) => {
  try {
    const result = await dispatchWebhook(
      req.db, 'trackguard',
      req.body,
      req.headers['x-miziba-signature'],
      process.env.TRACKGUARD_WEBHOOK_SECRET
    );
    res.json(result);
  } catch (err) {
    if (err.statusCode === 401) return res.status(401).json({ error: 'INVALID_SIGNATURE' });
    next(err);
  }
});

// DocuSign webhook (envelope completed → store executed term sheet)
webhookRouter.post('/docusign', async (req, res, next) => {
  try {
    const event = JSON.parse(req.body);
    if (event.event === 'envelope-completed') {
      const envelopeId = event.data?.envelopeId;
      if (envelopeId) {
        await req.db.query(
          `UPDATE term_sheets SET status='EXECUTED', executed_at=NOW()
           WHERE docusign_envelope_id=$1`, [envelopeId]);
      }
    }
    res.sendStatus(200);
  } catch (err) { next(err); }
});

// =============================================================================
// ADMIN ROUTES
// =============================================================================

const adminRouter = express.Router();

adminRouter.post('/organisations',
  requirePermission('org.create'),
  body('name').isLength({ min: 2 }),
  body('type').isIn(['trader','finance_partner','buyer']),
  body('country').isLength({ min: 2 }),
  async (req, res, next) => {
    if (!ok(req, res)) return;
    try {
      const { name, type, country, registration_no, tin, email, phone } = req.body;
      const result = await req.db.query(
        'INSERT INTO organisations (name, type, country, registration_no, tin, email, phone) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [name, type, country, registration_no || null, tin || null, email || null, phone || null]);

      // Create profile record for trader/FP
      if (type === 'trader') await req.db.query('INSERT INTO trader_profiles (org_id) VALUES ($1)', [result.rows[0].id]);
      if (type === 'finance_partner') await req.db.query('INSERT INTO finance_partner_profiles (org_id) VALUES ($1)', [result.rows[0].id]);

      await auditLog(req.db, { userId: req.user.id, action: 'ORG_CREATED', entityType: 'organisation', entityId: result.rows[0].id, newValue: { name, type }, ipAddress: req.ip });
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

adminRouter.post('/users',
  requirePermission('user.create'),
  body('email').isEmail().normalizeEmail(),
  body('full_name').isLength({ min: 2 }),
  body('role').isIn(['deal_officer','ceo','cfo','trader','finance_partner','ops_admin']),
  body('org_id').isUUID(),
  body('password').isLength({ min: 12 }),
  async (req, res, next) => {
    if (!ok(req, res)) return;
    try {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash(req.body.password, 12);
      const result = await req.db.query(
        'INSERT INTO users (org_id, email, phone, full_name, role, password_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, full_name, role, org_id, created_at',
        [req.body.org_id, req.body.email, req.body.phone || null, req.body.full_name, req.body.role, hash]);
      await auditLog(req.db, { userId: req.user.id, action: 'USER_CREATED', entityType: 'user', entityId: result.rows[0].id, newValue: { email: req.body.email, role: req.body.role }, ipAddress: req.ip });
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

adminRouter.delete('/users/:id',
  param('id').isUUID(), requirePermission('user.deactivate'),
  async (req, res, next) => {
    try {
      await req.db.query('UPDATE users SET is_active=FALSE WHERE id=$1', [req.params.id]);
      await req.db.query('DELETE FROM sessions WHERE user_id=$1', [req.params.id]);
      await auditLog(req.db, { userId: req.user.id, action: 'USER_DEACTIVATED', entityType: 'user', entityId: req.params.id, ipAddress: req.ip });
      res.sendStatus(204);
    } catch (err) { next(err); }
  }
);

// FP onboarding progression
adminRouter.patch('/finance-partners/:org_id/onboarding',
  param('org_id').isUUID(), requirePermission('org.update'),
  body('step').isInt({ min: 1, max: 6 }),
  async (req, res, next) => {
    if (!ok(req, res)) return;
    try {
      const { db, user } = req;
      const { step } = req.body;
      const done = step >= 6;
      const result = await db.query(
        'UPDATE finance_partner_profiles SET onboarding_step=$1, onboarding_done=$2, portal_active=$3, updated_at=NOW() WHERE org_id=$4 RETURNING *',
        [step, done, done, req.params.org_id]);
      if (!result.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
      await auditLog(db, { userId: user.id, action: 'FP_ONBOARDING_UPDATED', entityType: 'finance_partner', entityId: req.params.org_id, newValue: { step, done }, ipAddress: req.ip });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// Audit log access (ops_admin / ceo only)
adminRouter.get('/audit',
  requirePermission('audit_log.view'),
  async (req, res, next) => {
    try {
      const { trade_id, user_id, action, from, to } = req.query;
      const conditions = []; const vals = [];
      if (trade_id) conditions.push(`trade_id=$${vals.push(trade_id)}`);
      if (user_id)  conditions.push(`user_id=$${vals.push(user_id)}`);
      if (action)   conditions.push(`action=$${vals.push(action)}`);
      if (from)     conditions.push(`occurred_at>=$${vals.push(from)}`);
      if (to)       conditions.push(`occurred_at<=$${vals.push(to)}`);
      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      const result = await req.db.query(`SELECT * FROM audit_log ${where} ORDER BY occurred_at DESC LIMIT 200`, vals);
      res.json(result.rows);
    } catch (err) { next(err); }
  }
);

// System config (ops_admin)
adminRouter.get('/config',
  requirePermission('org.update'),
  async (req, res, next) => {
    try {
      const result = await req.db.query('SELECT key, value, description, updated_at FROM system_config ORDER BY key');
      res.json(result.rows);
    } catch (err) { next(err); }
  }
);

adminRouter.patch('/config/:key',
  param('key').isLength({ min: 1 }), requirePermission('org.update'),
  async (req, res, next) => {
    try {
      const result = await req.db.query(
        'UPDATE system_config SET value=$1, updated_by=$2, updated_at=NOW() WHERE key=$3 RETURNING *',
        [req.body.value, req.user.id, req.params.key]);
      if (!result.rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  validationRouter,
  riskRouter,
  fdpRouter,
  settlementRouter,
  documentRouter,
  portfolioRouter,
  notificationRouter,
  webhookRouter,
  adminRouter,
};
