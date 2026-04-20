/**
 * TRADEAXIS — WEBHOOK EVENT PROCESSOR
 * Miziba Infrastructure Ltd | Module 4
 *
 * Handles inbound events from:
 *  - TradeVault (escrow, payments, waterfall)
 *  - TrackGuard (shipment, delivery, alerts)
 *
 * Each event is:
 *  1. Signature-validated
 *  2. Idempotently stored in webhook_events
 *  3. Routed to the appropriate handler
 *  4. Trade state updated
 *  5. Notifications dispatched
 */

'use strict';

const crypto = require('crypto');
const { validateStageTransition, checkDeploymentHealth, getNotificationsForEvent } = require('./business-logic');

// ─── SIGNATURE VALIDATION ─────────────────────────────────────────────────────

/**
 * Validates HMAC-SHA256 webhook signature.
 * Both TradeVault and TrackGuard use the same signing scheme.
 *
 * Header: X-Miziba-Signature: sha256=<hex>
 */
function validateSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const received = signatureHeader.slice(7);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(received, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

// ─── TRADEVAULT EVENTS ────────────────────────────────────────────────────────

const TRADEVAULT_HANDLERS = {

  /**
   * escrow.funded
   * Fired when trader equity + FP facility are fully deposited in TradeVault escrow.
   * Automatically advances trade from FUNDED → PROCURING.
   */
  async 'escrow.funded'(db, event) {
    const { trade_ref, escrow_id, total_funded_usd, funded_at } = event.payload;

    const trade = await getTrade(db, trade_ref);
    if (!trade) throw new Error(`Trade not found: ${trade_ref}`);

    const transition = validateStageTransition(trade.stage, 'PROCURING', { escrowFunded: true });
    if (!transition.allowed) {
      console.warn(`[WEBHOOK] escrow.funded ignored for ${trade_ref}: ${transition.reason}`);
      return;
    }

    await db.query(
      `UPDATE trades SET stage = 'PROCURING', escrow_id = $1, funded_at = $2, updated_at = NOW()
       WHERE trade_ref = $3`,
      [escrow_id, funded_at, trade_ref]
    );

    await db.query(
      `INSERT INTO trade_stage_log (trade_id, from_stage, to_stage, changed_by, notes)
       VALUES ($1, $2, 'PROCURING', NULL, 'Auto-advanced by TradeVault escrow.funded event')`,
      [trade.id, trade.stage]
    );

    console.log(`[WEBHOOK] Trade ${trade_ref} advanced to PROCURING. Escrow: ${escrow_id}`);
  },

  /**
   * payment.confirmed
   * Fired when a farmer batch payment is confirmed in TradeVault.
   * Updates deployment_batches and recalculates deployment metrics.
   */
  async 'payment.confirmed'(db, event) {
    const {
      trade_ref, batch_ref, farmer_id_anon, tradepoint_name,
      weight_kg, amount_ghs, amount_usd, eudr_verified, grade,
      tradevault_tx_id, confirmed_at,
    } = event.payload;

    const trade = await getTrade(db, trade_ref);
    if (!trade) throw new Error(`Trade not found: ${trade_ref}`);

    // Upsert batch record
    await db.query(
      `INSERT INTO deployment_batches
         (batch_ref, trade_id, farmer_id_anon, tradepoint_name, weight_kg,
          amount_ghs, amount_usd, status, eudr_verified, grade, tradevault_tx_id, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED', $8, $9, $10, $11)
       ON CONFLICT (batch_ref) DO UPDATE
         SET status = 'CONFIRMED', paid_at = EXCLUDED.paid_at,
             tradevault_tx_id = EXCLUDED.tradevault_tx_id`,
      [batch_ref, trade.id, farmer_id_anon, tradepoint_name,
       weight_kg, amount_ghs, amount_usd, eudr_verified || false,
       grade || null, tradevault_tx_id, confirmed_at]
    );

    // Recalculate deployment metrics
    const metrics = await db.query(
      `SELECT
         SUM(weight_kg) / 1000.0 AS volume_procured_mt,
         COUNT(*) FILTER (WHERE status = 'CONFIRMED') AS confirmed_batches,
         SUM(amount_usd) FILTER (WHERE status = 'CONFIRMED') AS total_paid_usd,
         AVG(CASE WHEN grade = 'A' THEN 100.0 ELSE 0 END) AS grade_a_pct,
         AVG(CASE WHEN grade = 'B' THEN 100.0 ELSE 0 END) AS grade_b_pct,
         AVG(CASE WHEN grade = 'C' THEN 100.0 ELSE 0 END) AS grade_c_pct,
         AVG(CASE WHEN eudr_verified THEN 100.0 ELSE 0 END) AS eudr_pct
       FROM deployment_batches WHERE trade_id = $1`,
      [trade.id]
    );

    const m = metrics.rows[0];
    const volumeProcured = parseFloat(m.volume_procured_mt) || 0;
    const deployedPct = Math.min(100, (volumeProcured / trade.volume_mt) * 100);

    await db.query(
      `UPDATE trades SET
         volume_procured_mt = $1,
         capital_deployed_pct = $2,
         grade_a_pct = $3,
         grade_b_pct = $4,
         grade_c_pct = $5,
         eudr_compliance_pct = $6,
         updated_at = NOW()
       WHERE id = $7`,
      [volumeProcured, deployedPct, m.grade_a_pct, m.grade_b_pct,
       m.grade_c_pct, m.eudr_pct, trade.id]
    );

    // Check deployment health and fire alerts
    const health = checkDeploymentHealth({
      capitalDeployedPct: deployedPct,
      eudrCompliancePct: parseFloat(m.eudr_pct),
      gradeAPct: parseFloat(m.grade_a_pct),
      volumeProcuredMt: volumeProcured,
      volumeTargetMt: trade.volume_mt,
      deadlineDate: trade.deadline_date,
    });

    if (health.status !== 'HEALTHY') {
      await queueNotifications(db, trade, 'EUDR_ALERT');
    }

    console.log(`[WEBHOOK] Batch ${batch_ref} confirmed for ${trade_ref}. Deployed: ${deployedPct.toFixed(1)}%`);
  },

  /**
   * waterfall.settled
   * Fired when TradeVault completes the full waterfall disbursement.
   * Advances trade from DELIVERED → SETTLED.
   */
  async 'waterfall.settled'(db, event) {
    const {
      trade_ref, fp_paid_usd, miziba_paid_usd, trader_paid_usd,
      settled_at, tradevault_ref,
    } = event.payload;

    const trade = await getTrade(db, trade_ref);
    if (!trade) throw new Error(`Trade not found: ${trade_ref}`);

    await db.query(
      `UPDATE waterfall_instructions SET
         status = 'CONFIRMED',
         fp_payment_confirmed = true,
         fp_confirmed_at = $1,
         miziba_received = true,
         trader_released = true,
         tradevault_ref = $2,
         updated_at = NOW()
       WHERE trade_id = $3`,
      [settled_at, tradevault_ref, trade.id]
    );

    await db.query(
      `UPDATE trades SET stage = 'SETTLED', settled_at = $1, updated_at = NOW()
       WHERE id = $2`,
      [settled_at, trade.id]
    );

    await db.query(
      `INSERT INTO trade_stage_log (trade_id, from_stage, to_stage, changed_by, notes)
       VALUES ($1, 'DELIVERED', 'SETTLED', NULL, 'Auto-advanced by TradeVault waterfall.settled event')`,
      [trade.id]
    );

    await queueNotifications(db, trade, 'STAGE_SETTLED');

    console.log(`[WEBHOOK] Trade ${trade_ref} settled. FP: $${fp_paid_usd} | Miziba: $${miziba_paid_usd} | Trader: $${trader_paid_usd}`);
  },

  /**
   * payment.failed
   * Fired if a batch farmer payment fails in TradeVault.
   */
  async 'payment.failed'(db, event) {
    const { trade_ref, batch_ref, failure_reason } = event.payload;

    await db.query(
      `UPDATE deployment_batches SET status = 'FAILED', updated_at = NOW()
       WHERE batch_ref = $1`,
      [batch_ref]
    );

    console.error(`[WEBHOOK] Payment failed for batch ${batch_ref} on ${trade_ref}: ${failure_reason}`);
    // TODO: dispatch PAYMENT_FAILED notification to deal_officer + ceo
  },
};

// ─── TRACKGUARD EVENTS ────────────────────────────────────────────────────────

const TRACKGUARD_HANDLERS = {

  /**
   * shipment.created
   * Fired when TrackGuard creates a shipment for a funded trade.
   */
  async 'shipment.created'(db, event) {
    const { trade_ref, trackguard_id, origin, destination, eta } = event.payload;

    const trade = await getTrade(db, trade_ref);
    if (!trade) throw new Error(`Trade not found: ${trade_ref}`);

    await db.query(
      `INSERT INTO shipment_records (trade_id, trackguard_id, status, origin, destination, eta)
       VALUES ($1, $2, 'CREATED', $3, $4, $5)
       ON CONFLICT (trade_id) DO UPDATE
         SET trackguard_id = EXCLUDED.trackguard_id, status = 'CREATED',
             origin = EXCLUDED.origin, eta = EXCLUDED.eta, updated_at = NOW()`,
      [trade.id, trackguard_id, origin, destination, eta]
    );

    await db.query(
      `UPDATE trades SET shipment_id = $1, updated_at = NOW() WHERE id = $2`,
      [trackguard_id, trade.id]
    );

    console.log(`[WEBHOOK] Shipment ${trackguard_id} created for ${trade_ref}`);
  },

  /**
   * shipment.in_transit
   * Updates GPS position and ETA.
   */
  async 'shipment.in_transit'(db, event) {
    const { trade_ref, trackguard_id, gps_lat, gps_lng, gps_city, eta, updated_at } = event.payload;

    await db.query(
      `UPDATE shipment_records SET
         status = 'IN_TRANSIT',
         last_gps_lat = $1, last_gps_lng = $2, last_gps_city = $3,
         eta = $4, last_update = $5, updated_at = NOW()
       WHERE trackguard_id = $6`,
      [gps_lat, gps_lng, gps_city, eta, updated_at, trackguard_id]
    );
  },

  /**
   * shipment.alert
   * Logs a TrackGuard alert to shipment_alerts.
   */
  async 'shipment.alert'(db, event) {
    const { trade_ref, trackguard_id, alert_type, severity, message, occurred_at } = event.payload;

    const shipment = await db.query(
      'SELECT id FROM shipment_records WHERE trackguard_id = $1', [trackguard_id]
    );

    if (!shipment.rows.length) return;

    await db.query(
      `INSERT INTO shipment_alerts (shipment_id, alert_type, severity, message, occurred_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [shipment.rows[0].id, alert_type, severity, message, occurred_at]
    );

    if (severity === 'CRITICAL') {
      const trade = await getTrade(db, trade_ref);
      await queueNotifications(db, trade, 'SHIPMENT_CRITICAL_ALERT');
    }

    console.log(`[WEBHOOK] Shipment alert [${severity}] for ${trade_ref}: ${alert_type}`);
  },

  /**
   * shipment.delivered
   * Records delivery confirmation. Advances trade to DELIVERED.
   * Triggers buyer payment clock.
   */
  async 'shipment.delivered'(db, event) {
    const {
      trade_ref, trackguard_id, delivered_weight_mt, weight_variance_pct, delivered_at,
    } = event.payload;

    const trade = await getTrade(db, trade_ref);
    if (!trade) throw new Error(`Trade not found: ${trade_ref}`);

    const transition = validateStageTransition(trade.stage, 'DELIVERED', {});
    if (!transition.allowed) {
      console.warn(`[WEBHOOK] shipment.delivered ignored for ${trade_ref}: ${transition.reason}`);
      return;
    }

    await db.query(
      `UPDATE shipment_records SET
         status = 'DELIVERED', delivered_at = $1,
         delivered_weight_mt = $2, weight_variance_pct = $3,
         last_update = $1, updated_at = NOW()
       WHERE trackguard_id = $4`,
      [delivered_at, delivered_weight_mt, weight_variance_pct, trackguard_id]
    );

    await db.query(
      `UPDATE trades SET
         stage = 'DELIVERED', delivered_at = $1,
         delivered_weight_mt = $2, weight_variance_pct = $3,
         updated_at = NOW()
       WHERE id = $4`,
      [delivered_at, delivered_weight_mt, weight_variance_pct, trade.id]
    );

    await db.query(
      `INSERT INTO trade_stage_log (trade_id, from_stage, to_stage, changed_by, notes)
       VALUES ($1, $2, 'DELIVERED', NULL, 'Auto-advanced by TrackGuard shipment.delivered event')`,
      [trade.id, trade.stage]
    );

    await queueNotifications(db, trade, 'STAGE_DELIVERED');

    console.log(`[WEBHOOK] Trade ${trade_ref} delivered. Weight: ${delivered_weight_mt} MT. Variance: ${weight_variance_pct}%`);
  },

  /**
   * ccc.issued
   * Chain-of-Custody Certificate issued by TrackGuard.
   * Stores reference in shipment_records and trade_documents.
   */
  async 'ccc.issued'(db, event) {
    const { trade_ref, trackguard_id, ccc_s3_key, issued_at } = event.payload;

    await db.query(
      `UPDATE shipment_records SET ccc_issued = true, ccc_s3_key = $1, updated_at = NOW()
       WHERE trackguard_id = $2`,
      [ccc_s3_key, trackguard_id]
    );

    const trade = await getTrade(db, trade_ref);
    if (trade) {
      await db.query(
        `INSERT INTO trade_documents
           (trade_id, doc_type, name, s3_key, s3_bucket, status, uploaded_by, is_locked)
         VALUES ($1, 'ccc', 'Chain-of-Custody Certificate', $2, 'miziba-tradeaxis-docs', 'ACCEPTED', NULL, true)
         ON CONFLICT (s3_key) DO NOTHING`,
        [trade.id, ccc_s3_key]
      );
    }

    console.log(`[WEBHOOK] CCC issued for ${trade_ref}. S3 key: ${ccc_s3_key}`);
  },
};

// ─── MAIN DISPATCHER ─────────────────────────────────────────────────────────

/**
 * Main webhook dispatcher.
 * Called by Express route handlers for /webhooks/tradevault and /webhooks/trackguard.
 */
async function dispatchWebhook(db, source, rawBody, signatureHeader, secret) {
  // 1. Validate signature
  if (!validateSignature(rawBody, signatureHeader, secret)) {
    throw Object.assign(new Error('Invalid webhook signature'), { statusCode: 401 });
  }

  const event = JSON.parse(rawBody);
  const eventType = event.event_type;

  // 2. Idempotency — check if we've already processed this event
  const idempotencyKey = `${source}:${eventType}:${event.payload?.trade_ref}:${event.occurred_at}`;
  const existing = await db.query(
    `SELECT id FROM webhook_events WHERE source = $1 AND event_type = $2
     AND payload->>'trade_ref' = $3 AND received_at > NOW() - INTERVAL '24 hours'
     AND processed = true LIMIT 1`,
    [source, eventType, event.payload?.trade_ref]
  );

  if (existing.rows.length) {
    console.log(`[WEBHOOK] Duplicate event ignored: ${idempotencyKey}`);
    return { status: 'duplicate' };
  }

  // 3. Store event
  const stored = await db.query(
    `INSERT INTO webhook_events (source, event_type, payload, trade_id)
     VALUES ($1, $2, $3, (SELECT id FROM trades WHERE trade_ref = $4 LIMIT 1))
     RETURNING id`,
    [source, eventType, JSON.stringify(event.payload), event.payload?.trade_ref]
  );

  const webhookEventId = stored.rows[0].id;

  // 4. Route to handler
  const handlers = source === 'tradevault' ? TRADEVAULT_HANDLERS : TRACKGUARD_HANDLERS;
  const handler = handlers[eventType];

  if (!handler) {
    console.warn(`[WEBHOOK] No handler for ${source}:${eventType}`);
    await db.query(
      `UPDATE webhook_events SET processed = true, processed_at = NOW(), error = 'No handler'
       WHERE id = $1`,
      [webhookEventId]
    );
    return { status: 'no_handler' };
  }

  try {
    await handler(db, event);
    await db.query(
      `UPDATE webhook_events SET processed = true, processed_at = NOW() WHERE id = $1`,
      [webhookEventId]
    );
    return { status: 'ok' };
  } catch (err) {
    await db.query(
      `UPDATE webhook_events SET error = $1 WHERE id = $2`,
      [err.message, webhookEventId]
    );
    throw err;
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function getTrade(db, tradeRef) {
  const result = await db.query(
    `SELECT t.*, o.name AS trader_name, fp.name AS fp_name
     FROM trades t
     LEFT JOIN organisations o ON o.id = t.trader_org_id
     LEFT JOIN organisations fp ON fp.id = t.fp_org_id
     WHERE t.trade_ref = $1`,
    [tradeRef]
  );
  return result.rows[0] || null;
}

async function queueNotifications(db, trade, event) {
  // Fetch relevant users for the trade
  const users = await db.query(
    `SELECT u.id, u.email, u.role, u.full_name, o.name AS org_name
     FROM users u
     JOIN organisations o ON o.id = u.org_id
     WHERE o.id = $1 OR o.id = $2 OR u.role IN ('ceo','cfo','deal_officer')`,
    [trade.trader_org_id, trade.fp_org_id || '00000000-0000-0000-0000-000000000000']
  );

  const byRole = {};
  users.rows.forEach(u => { byRole[u.role] = u; });

  const context = {
    trade,
    dealOfficer: byRole['deal_officer'],
    trader: byRole['trader'],
    fp: byRole['finance_partner'],
    ceo: byRole['ceo'],
    cfo: byRole['cfo'],
  };

  const notifications = getNotificationsForEvent(event, context);

  for (const n of notifications) {
    if (!n.to) continue;
    await db.query(
      `INSERT INTO notifications (user_id, trade_id, channel, subject, body, template_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [n.to.id, trade.id, n.channel, n.subject || null, n.body, event]
    );
  }
}

// ─── OUTBOUND EVENT EMITTERS ─────────────────────────────────────────────────
// For sending events TO TradeVault (waterfall instruction) and TrackGuard

/**
 * Instructs TradeVault to execute waterfall settlement.
 * This is the outbound call from the CFO settlement confirmation.
 */
async function instructTradeVaultWaterfall(httpClient, {
  tradeRef, escrowId, fpOrgId, fpAccountSwift, fpAccountNo,
  fpTotalUsd, mizabaFeeUsd, traderOrgId, tenorDays, fpFeeRatePa,
}) {
  const payload = {
    trade_ref:          tradeRef,
    escrow_id:          escrowId,
    waterfall: [
      { tier: 1, recipient: 'finance_partner', org_id: fpOrgId, swift: fpAccountSwift, account_no: fpAccountNo, amount_usd: fpTotalUsd },
      { tier: 2, recipient: 'miziba', amount_usd: mizabaFeeUsd },
      { tier: 3, recipient: 'trader', org_id: traderOrgId, amount_usd: null }, // TradeVault calculates residual
    ],
    fee_rate_pa:  fpFeeRatePa,
    tenor_days:   tenorDays,
  };

  // httpClient is an axios instance pre-configured with TradeVault base URL + auth
  const response = await httpClient.post('/waterfall/instruct', payload);
  return response.data;
}

module.exports = {
  dispatchWebhook,
  validateSignature,
  instructTradeVaultWaterfall,
  TRADEVAULT_HANDLERS,
  TRACKGUARD_HANDLERS,
};
