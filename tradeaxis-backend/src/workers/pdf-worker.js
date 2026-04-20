'use strict';

/**
 * TRADEAXIS — PDF GENERATION WORKER
 * SQS consumer generating Finance Data Package PDFs via Puppeteer headless Chrome.
 * Run as a separate ECS task.
 *
 * Queue: tradeaxis-pdf-jobs
 * Target: PDF ready < 15 seconds from queue pick-up (per NFR spec)
 *
 * Start: node src/workers/pdf-worker.js
 */

require('dotenv').config();

const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const { assembleFDP } = require('../../core/business-logic');

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const s3  = new S3Client({ region: process.env.AWS_REGION || 'eu-west-1' });

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  max: 3,
});

const QUEUE_URL  = process.env.PDF_QUEUE_URL;
const S3_BUCKET  = process.env.AWS_S3_BUCKET || 'miziba-tradeaxis-docs';

// ─── FETCH TRADE DATA FOR FDP ────────────────────────────────────────────────

async function fetchFDPData(tradeId) {
  const [tradeRes, riskRes, batchRes] = await Promise.all([
    db.query(`
      SELECT t.*, o.name AS trader_name, o.registration_no AS trader_reg,
             b.name AS buyer_name, b.country AS buyer_country,
             b.sanctions_clear, b.sanctions_checked_at,
             b.trades_completed AS buyer_trades, b.trades_on_time,
             b.disputes AS buyer_disputes,
             tp.bank_name, tp.trades_completed AS trader_trades,
             tp.trades_defaulted, tp.risk_score AS trader_risk_score
      FROM trades t
      JOIN organisations o ON o.id = t.trader_org_id
      JOIN buyers b ON b.id = t.buyer_id
      LEFT JOIN trader_profiles tp ON tp.org_id = t.trader_org_id
      WHERE t.id = $1`, [tradeId]),
    db.query('SELECT * FROM trade_risk_scores WHERE trade_id=$1', [tradeId]),
    db.query('SELECT * FROM deployment_batches WHERE trade_id=$1 ORDER BY created_at', [tradeId]),
  ]);

  const trade = tradeRes.rows[0];
  if (!trade) throw new Error(`Trade not found: ${tradeId}`);

  return { trade, risk: riskRes.rows[0], batches: batchRes.rows };
}

// ─── RENDER HTML TEMPLATE ────────────────────────────────────────────────────

function renderFDPHtml(fdp) {
  const { meta, sections: s } = fdp;
  const fmt = (cents) => cents != null ? `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #111827; padding: 32px; }
  h1 { font-size: 18px; color: #8B0000; margin-bottom: 4px; }
  h2 { font-size: 13px; color: #0D1F3C; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #E2E5EA; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #8B0000; }
  .logo { font-size: 22px; font-weight: 700; color: #0D1F3C; }
  .confidential { font-size: 10px; color: #DC2626; font-weight: 700; letter-spacing: 0.08em; }
  .row { display: flex; padding: 5px 0; border-bottom: 1px solid #F3F4F6; }
  .row .label { width: 200px; flex-shrink: 0; font-size: 10px; color: #6B7280; font-weight: 600; }
  .row .value { font-size: 11px; color: #111827; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 9px; font-weight: 700; }
  .badge-green { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }
  .badge-red { background: #FEF2F2; color: #8B0000; border: 1px solid #FECACA; }
  .wf-tier { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 6px; margin-bottom: 6px; background: #F8FAFC; }
  .tier-num { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E5EA; font-size: 9px; color: #9CA3AF; text-align: center; }
  @page { margin: 20mm; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">TradeAxis · Miziba Infrastructure Ltd</div>
    <div style="font-size:11px;color:#6B7280;margin-top:3px">Finance Data Package</div>
  </div>
  <div style="text-align:right">
    <div class="confidential">CONFIDENTIAL</div>
    <div style="font-size:10px;color:#9CA3AF;margin-top:3px">${new Date(meta.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>
</div>

<h1>${meta.tradeRef}</h1>
<div style="font-size:11px;color:#6B7280;margin-bottom:16px">${s.executive_summary.commodity} · ${s.executive_summary.volumeMt} MT · ${s.executive_summary.buyer} · Risk: ${s.executive_summary.riskScore}/100</div>

<h2>1. Executive Summary</h2>
<div class="row"><div class="label">Trade Reference</div><div class="value" style="font-family:monospace;font-weight:700;color:#8B0000">${meta.tradeRef}</div></div>
<div class="row"><div class="label">Commodity</div><div class="value">${s.executive_summary.commodity}</div></div>
<div class="row"><div class="label">Contract Value</div><div class="value" style="font-weight:700">${fmt(s.executive_summary.contractValueUsd)}</div></div>
<div class="row"><div class="label">Finance Facility Required</div><div class="value" style="font-weight:700;color:#7C3AED">${fmt(s.executive_summary.facilityUsd)}</div></div>
<div class="row"><div class="label">Projected FP Return</div><div class="value" style="color:#16A34A;font-weight:600">${fmt(s.executive_summary.projectedFpReturnUsd)} (12% p.a.)</div></div>
<div class="row"><div class="label">Risk Score</div><div class="value"><span class="badge badge-green">${s.executive_summary.riskScore}/100 · ${s.executive_summary.riskBand}</span></div></div>
<div class="row"><div class="label">Delivery Deadline</div><div class="value">${s.executive_summary.deadline}</div></div>

<h2>2. Buyer Profile</h2>
<div class="row"><div class="label">Buyer</div><div class="value">${s.buyer_profile.name} (${s.buyer_profile.country})</div></div>
<div class="row"><div class="label">Sanctions</div><div class="value"><span class="badge ${s.buyer_profile.sanctionsClear ? 'badge-green' : 'badge-red'}">${s.buyer_profile.sanctionsClear ? 'CLEAR — OFAC/EU/UN verified' : 'PENDING VERIFICATION'}</span></div></div>
<div class="row"><div class="label">Payment Record</div><div class="value">${s.buyer_profile.paymentRecord}</div></div>
<div class="row"><div class="label">Disputes</div><div class="value">${s.buyer_profile.disputes}</div></div>

<h2>5. Financial Structure</h2>
<div class="row"><div class="label">Procurement Cost</div><div class="value">${fmt(s.financial_structure.procurementCostUsd)}</div></div>
<div class="row"><div class="label">Trader Equity (${s.financial_structure.traderEquityPct}%)</div><div class="value" style="color:#2563EB;font-weight:600">${fmt(s.financial_structure.traderEquityUsd)}</div></div>
<div class="row"><div class="label">Finance Facility (${s.financial_structure.facilityPct}%)</div><div class="value" style="color:#7C3AED;font-weight:600">${fmt(s.financial_structure.financeFacilityUsd)}</div></div>
<div class="row"><div class="label">Break-Even Buyer Price</div><div class="value" style="font-family:monospace">$${(s.financial_structure.breakEvenPricePerMt / 100).toFixed(2)}/MT</div></div>
<div class="row"><div class="label">FP Fee Rate</div><div class="value">${(s.financial_structure.fpFeeRatePa * 100).toFixed(1)}% p.a.</div></div>

<h2>Waterfall Settlement Order</h2>
<div class="wf-tier"><div class="tier-num" style="background:#C9943A;color:#fff">1</div><div><div style="font-weight:600;color:#C9943A">Finance Partner — Principal + Fee · PAID FIRST</div><div style="color:#6B7280">Structurally enforced by TradeVault escrow</div></div></div>
<div class="wf-tier"><div class="tier-num" style="background:#6B7280;color:#fff">2</div><div><div style="font-weight:600">Miziba Facilitation Fee</div></div></div>
<div class="wf-tier"><div class="tier-num" style="background:#E5E7EB;color:#374151">3</div><div><div style="font-weight:600">Trader Margin — Residual · Released Last</div></div></div>

<h2>6. Risk Assessment</h2>
${s.risk_assessment.breakdown.map(d => `
<div class="row">
  <div class="label">${d.label}</div>
  <div class="value" style="font-family:monospace">${d.score}/${d.max} <span style="color:#9CA3AF">(${d.pct}%)</span></div>
</div>`).join('')}
<div class="row"><div class="label">Total Score</div><div class="value" style="font-weight:700;color:${s.risk_assessment.totalScore >= 75 ? '#16A34A' : '#D97706'}">${s.risk_assessment.totalScore}/100 · ${s.risk_assessment.band}</div></div>

<div class="footer">
  Miziba Infrastructure Ltd · TradeAxis Module 4 · ${meta.tradeRef} · Generated ${new Date(meta.generatedAt).toISOString()} · CONFIDENTIAL · Not for redistribution
</div>
</body>
</html>`;
}

// ─── GENERATE PDF ─────────────────────────────────────────────────────────────

async function generatePDF(tradeId, fdpId) {
  const start = Date.now();

  const { trade, risk, batches } = await fetchFDPData(tradeId);

  const riskScores = risk ? {
    buyer_risk: risk.buyer_risk,
    trader_risk: risk.trader_risk,
    commodity_price_risk: risk.commodity_price_risk,
    sourcing_supply_risk: risk.sourcing_supply_risk,
    logistics_delivery_risk: risk.logistics_delivery_risk,
  } : { buyer_risk: 15, trader_risk: 18, commodity_price_risk: 14, sourcing_supply_risk: 11, logistics_delivery_risk: 10 };

  const fdp = assembleFDP({
    trade: {
      tradeRef: trade.trade_ref,
      commodity: trade.commodity,
      grade: trade.grade,
      volumeMt: parseFloat(trade.volume_mt),
      pricePerMtUsd: parseFloat(trade.price_per_mt_usd) * 100,  // cents
      contractValueUsd: parseFloat(trade.contract_value_usd) * 100,
      procurementCostUsd: parseFloat(trade.procurement_cost_usd) * 100,
      traderEquityUsd: parseFloat(trade.trader_equity_usd) * 100,
      financeFacilityUsd: parseFloat(trade.finance_facility_usd) * 100,
      deadlineDate: trade.deadline_date,
      paymentTermsDays: trade.payment_terms_days,
    },
    trader: {
      name: trade.trader_name,
      traderId: trade.trader_org_id,
      tradesCompleted: trade.trader_trades || 0,
    },
    buyer: {
      name: trade.buyer_name,
      country: trade.buyer_country,
      sanctionsClear: trade.sanctions_clear,
      sanctionsCheckedAt: trade.sanctions_checked_at,
      tradesCompleted: trade.buyer_trades || 0,
      tradesOnTime: trade.trades_on_time || 0,
      disputes: trade.buyer_disputes || 0,
    },
    riskScores,
    batches,
  });

  const html = renderFDPHtml(fdp);

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  let pdfBuffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
    });
  } finally {
    await browser.close();
  }

  // Upload to S3
  const s3Key = `trades/${tradeId}/fdp/v${Date.now()}/fdp_${trade.trade_ref}.pdf`;
  const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    ServerSideEncryption: 'AES256',
    Metadata: { 'trade-ref': trade.trade_ref, 'fdp-id': fdpId, 'checksum': checksum },
  }));

  // Update FDP record
  await db.query(
    'UPDATE finance_data_packages SET pdf_s3_key=$1, pdf_ready=TRUE, checksum=$2 WHERE id=$3',
    [s3Key, checksum, fdpId]
  );

  const elapsed = Date.now() - start;
  console.log(`[PDF] Generated for ${trade.trade_ref} in ${elapsed}ms. S3: ${s3Key}`);

  if (elapsed > 15000) {
    console.warn(`[PDF] Generation exceeded 15s target (${elapsed}ms). Review Puppeteer configuration.`);
  }

  return { s3Key, checksum };
}

// ─── POLL LOOP ─────────────────────────────────────────────────────────────────

async function processPDFJob(message) {
  const { trade_id, fdp_id } = JSON.parse(message.Body);
  await generatePDF(trade_id, fdp_id);
}

async function poll() {
  if (!QUEUE_URL) {
    console.warn('[PDF] PDF_QUEUE_URL not set. Worker idle.');
    return;
  }

  const response = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 1,     // PDF generation is CPU-heavy — process one at a time
    WaitTimeSeconds: 10,
    VisibilityTimeout: 60,      // 60s visibility (PDF takes up to 15s)
  }));

  for (const message of (response.Messages || [])) {
    try {
      await processPDFJob(message);
      await sqs.send(new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      }));
    } catch (err) {
      console.error('[PDF] Job failed:', err.message);
    }
  }
}

process.on('SIGTERM', async () => {
  console.log('[PDF] Shutting down...');
  await db.end();
  process.exit(0);
});

(async () => {
  console.log('[PDF] PDF generation worker started.');
  while (true) {
    try { await poll(); }
    catch (err) { console.error('[PDF] Poll error:', err.message); }
    await new Promise(r => setTimeout(r, 500));
  }
})();
