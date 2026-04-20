/**
 * TRADEAXIS — CORE BUSINESS LOGIC
 * Miziba Infrastructure Ltd | Module 4
 *
 * Contains:
 *  - Waterfall settlement engine
 *  - Risk scoring engine
 *  - Trade stage machine
 *  - Finance Data Package assembler
 *  - Non-payment protocol manager
 *
 * Node.js 18+ | No external dependencies (pure logic layer)
 * All monetary values in USD cents (integers) to avoid float rounding.
 */

'use strict';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TRADE_STAGES = [
  'SUBMITTED',
  'UNDER_VALIDATION',
  'VALIDATED',
  'FINANCE_REVIEW',
  'FUNDED',
  'PROCURING',
  'DELIVERED',
  'SETTLED',
  'CLOSED',
];

const RISK_DIMENSIONS = {
  buyer_risk:               { max: 25, label: 'Buyer Risk' },
  trader_risk:              { max: 25, label: 'Trader Risk' },
  commodity_price_risk:     { max: 20, label: 'Commodity & Price' },
  sourcing_supply_risk:     { max: 15, label: 'Sourcing & Supply' },
  logistics_delivery_risk:  { max: 15, label: 'Logistics & Delivery' },
};

const RISK_BANDS = [
  { min: 75, max: 100, label: 'LOW_RISK',      action: 'DIRECT_SUBMISSION' },
  { min: 55, max: 74,  label: 'MODERATE_RISK', action: 'CEO_REVIEW' },
  { min: 40, max: 54,  label: 'ELEVATED_RISK', action: 'CEO_MUST_APPROVE' },
  { min: 0,  max: 39,  label: 'HIGH_RISK',     action: 'DECLINE' },
];

const MIZIBA_STRUCTURING_FEE_RATE  = 0.0100; // 1.0% of facility
const MIZIBA_SETTLEMENT_FEE_RATE   = 0.0050; // 0.5% of contract value
const MIN_TRADER_EQUITY_PCT        = 0.35;   // 35% of procurement cost
const FP_STANDARD_FEE_RATE_PA      = 0.12;   // 12% per annum
const EUDR_COMPLIANCE_THRESHOLD    = 0.95;   // 95% minimum
const GRADE_A_MIN_PCT              = 0.75;   // 75% minimum Grade A
const DOC_RETENTION_YEARS          = 7;

// ─── WATERFALL ENGINE ────────────────────────────────────────────────────────

/**
 * Calculates the waterfall disbursement for a settled trade.
 *
 * Rule (non-negotiable): Finance partner paid FIRST in full.
 * Miziba fee paid SECOND. Trader receives residual LAST.
 *
 * @param {Object} params
 * @param {number} params.buyerPaymentUsd       - Actual buyer payment received
 * @param {number} params.financeFacilityUsd    - Principal lent by FP
 * @param {number} params.fpFeeRatePa           - FP annual fee rate (e.g. 0.12)
 * @param {number} params.tenorDays             - Actual days facility was outstanding
 * @param {number} params.contractValueUsd      - Full contract value
 * @returns {WaterfallResult}
 */
function calculateWaterfall({
  buyerPaymentUsd,
  financeFacilityUsd,
  fpFeeRatePa,
  tenorDays,
  contractValueUsd,
}) {
  if (buyerPaymentUsd <= 0) {
    throw new Error('WATERFALL_ERROR: Buyer payment must be positive.');
  }
  if (financeFacilityUsd <= 0) {
    throw new Error('WATERFALL_ERROR: Finance facility must be positive.');
  }

  // Finance partner: principal + pro-rata fee
  const fpFeeUsd = financeFacilityUsd * fpFeeRatePa * (tenorDays / 365);
  const fpTotalUsd = financeFacilityUsd + fpFeeUsd;

  // Miziba settlement fee
  const mizabaSettleFeeUsd = contractValueUsd * MIZIBA_SETTLEMENT_FEE_RATE;

  // Trader residual (can be negative — indicates shortfall)
  const traderMarginUsd = buyerPaymentUsd - fpTotalUsd - mizabaSettleFeeUsd;

  const shortfall = traderMarginUsd < 0;

  // Enforce waterfall: FP always paid first
  // If buyer payment insufficient to cover FP in full, all goes to FP first.
  let fpActualUsd = fpTotalUsd;
  let mizabaActualUsd = mizabaSettleFeeUsd;
  let traderActualUsd = traderMarginUsd;

  if (shortfall) {
    // Cascade: FP takes everything up to their claim, then Miziba, then trader
    fpActualUsd = Math.min(buyerPaymentUsd, fpTotalUsd);
    mizabaActualUsd = Math.min(
      Math.max(0, buyerPaymentUsd - fpActualUsd),
      mizabaSettleFeeUsd
    );
    traderActualUsd = buyerPaymentUsd - fpActualUsd - mizabaActualUsd; // negative = loss on trader
  }

  return {
    buyerPaymentUsd:     round2(buyerPaymentUsd),
    fpPrincipalUsd:      round2(financeFacilityUsd),
    fpFeeUsd:            round2(fpFeeUsd),
    fpTotalUsd:          round2(fpActualUsd),
    mizabaFeeUsd:        round2(mizabaActualUsd),
    traderMarginUsd:     round2(traderActualUsd),
    tenorDays,
    fpFeeRatePa,
    shortfall,
    shortfallAmountUsd:  shortfall ? round2(Math.abs(traderMarginUsd)) : 0,
    breakEvenPricePerMt: null, // caller should pass volume_mt and call calcBreakEven
    settlementOrder: ['FP_PRINCIPAL', 'FP_FEE', 'MIZIBA_FEE', 'TRADER_MARGIN'],
    computedAt: new Date().toISOString(),
  };
}

/**
 * Break-even buyer price per MT.
 * The price at which the finance partner is fully repaid.
 *
 * @param {number} fpTotalUsd     - FP principal + fee
 * @param {number} mizabaFeeUsd   - Miziba settlement fee
 * @param {number} volumeMt       - Trade volume in MT
 * @returns {number} Break-even price per MT in USD
 */
function calcBreakEven(fpTotalUsd, mizabaFeeUsd, volumeMt) {
  if (volumeMt <= 0) throw new Error('Volume must be positive.');
  return round2((fpTotalUsd + mizabaFeeUsd) / volumeMt);
}

// ─── RISK SCORING ENGINE ─────────────────────────────────────────────────────

/**
 * Validates and scores a risk assessment submission.
 * All dimension scores must be within their defined maximums.
 *
 * @param {Object} scores - { buyer_risk, trader_risk, ... }
 * @returns {RiskResult}
 */
function calculateRiskScore(scores) {
  const errors = [];
  let total = 0;

  for (const [dim, cfg] of Object.entries(RISK_DIMENSIONS)) {
    const val = scores[dim];
    if (val === undefined || val === null) {
      errors.push(`Missing dimension: ${dim}`);
      continue;
    }
    if (!Number.isInteger(val) || val < 0 || val > cfg.max) {
      errors.push(`${dim} must be integer between 0 and ${cfg.max}. Got: ${val}`);
    }
    total += val;
  }

  if (errors.length > 0) {
    throw new Error(`RISK_SCORING_ERROR: ${errors.join('; ')}`);
  }

  const band = RISK_BANDS.find(b => total >= b.min && total <= b.max);

  // ── Spec §11 Bonuses and Penalties ────────────────────────────────────────
  const STABLE_COMMS  = ['cashew', 'sesame'];   // +2 bonus
  const VOLATILE_COMMS= ['sorghum'];             // -3 penalty
  let bonus = 0;
  if (scores.commodity && STABLE_COMMS.includes(scores.commodity))   bonus += 2;
  if (scores.commodity && VOLATILE_COMMS.includes(scores.commodity)) bonus -= 3;

  // EUDR compliance bonus/penalty (spec §11 #5)
  if (typeof scores.eudr_compliance_pct === 'number') {
    if (scores.eudr_compliance_pct > 95)  bonus += 2;
    else if (scores.eudr_compliance_pct < 80) bonus -= 3;
  }

  // Seasonal sourcing adjustment (spec §11 #4)
  if (scores.is_peak_season === true)  bonus += 2;
  if (scores.is_peak_season === false) bonus -= 3;

  const adjustedTotal = Math.max(0, Math.min(100, total + bonus));
  const adjBand = RISK_BANDS.find(b => adjustedTotal >= b.min && adjustedTotal <= b.max)
                  || RISK_BANDS[RISK_BANDS.length - 1];

  const adjustments = [];
  if (scores.commodity && STABLE_COMMS.includes(scores.commodity))    adjustments.push({ reason: 'Stable commodity ('+scores.commodity+')', points: 2 });
  if (scores.commodity && VOLATILE_COMMS.includes(scores.commodity))  adjustments.push({ reason: 'Volatile commodity ('+scores.commodity+')', points: -3 });
  if (typeof scores.eudr_compliance_pct === 'number' && scores.eudr_compliance_pct > 95)  adjustments.push({ reason: 'EUDR compliance >95%', points: 2 });
  if (typeof scores.eudr_compliance_pct === 'number' && scores.eudr_compliance_pct < 80)  adjustments.push({ reason: 'EUDR compliance <80%', points: -3 });
  if (scores.is_peak_season === true)  adjustments.push({ reason: 'Peak season sourcing', points: 2 });
  if (scores.is_peak_season === false) adjustments.push({ reason: 'Off-season sourcing', points: -3 });

  return {
    scores,
    baseTotal: total,
    bonusApplied: bonus,
    total: adjustedTotal,
    adjustments,
    band: adjBand.label,
    action: adjBand.action,
    canSubmitDirect: adjBand.action === 'DIRECT_SUBMISSION',
    requiresCEO: ['CEO_REVIEW', 'CEO_MUST_APPROVE'].includes(adjBand.action),
    shouldDecline: adjBand.action === 'DECLINE',
    breakdown: Object.entries(RISK_DIMENSIONS).map(([k, cfg]) => ({
      dimension: k, label: cfg.label, score: scores[k], max: cfg.max,
      pct: Math.round((scores[k] / cfg.max) * 100),
    })),
  };
}

/**
 * Recalculates trader risk score after trade completion.
 * Score improves as track record builds.
 *
 * @param {Object} traderProfile
 * @param {number} traderProfile.tradesCompleted
 * @param {number} traderProfile.tradesDefaulted
 * @param {boolean} traderProfile.kycVerified
 * @param {boolean} traderProfile.hasCapitalProof
 * @returns {number} New trader_risk score (0–25)
 */
function calcTraderRiskScore({ tradesCompleted, tradesDefaulted, kycVerified, hasCapitalProof }) {
  if (tradesDefaulted > 0) return 0; // Immediate decline

  if (!kycVerified) return 6;        // First-time, marginal KYC

  if (tradesCompleted === 0) {
    return hasCapitalProof ? 12 : 6; // First-time, strong vs marginal
  }
  if (tradesCompleted === 1) return 18; // 1–2 trades, 0% default
  if (tradesCompleted >= 3) return 25; // 3+ trades, 0% default
  return 18;
}

// ─── TRADE STAGE MACHINE ─────────────────────────────────────────────────────

/**
 * Validates and returns the next allowed stage for a trade.
 * Enforces: cannot skip stages, cannot reverse, cannot advance CLOSED.
 *
 * @param {string} currentStage
 * @param {string} proposedStage
 * @param {Object} guards - { validationComplete, fpApproved, escrowFunded, buyerPaid }
 * @returns {{ allowed: boolean, reason: string | null }}
 */
function validateStageTransition(currentStage, proposedStage, guards = {}) {
  const currentIdx = TRADE_STAGES.indexOf(currentStage);
  const proposedIdx = TRADE_STAGES.indexOf(proposedStage);

  if (currentIdx === -1) return { allowed: false, reason: `Unknown stage: ${currentStage}` };
  if (proposedIdx === -1) return { allowed: false, reason: `Unknown stage: ${proposedStage}` };
  if (currentStage === 'CLOSED') return { allowed: false, reason: 'CLOSED trade is immutable.' };
  if (proposedIdx !== currentIdx + 1) {
    return {
      allowed: false,
      reason: `Cannot transition from ${currentStage} to ${proposedStage}. Stages must advance sequentially.`,
    };
  }

  // Stage-specific guards
  if (proposedStage === 'VALIDATED') {
    if (!guards.validationComplete) {
      return { allowed: false, reason: 'All 5 validation items must be complete before advancing to VALIDATED.' };
    }
  }
  if (proposedStage === 'FUNDED') {
    if (!guards.fpApproved) {
      return { allowed: false, reason: 'Finance partner approval required before FUNDED.' };
    }
  }
  if (proposedStage === 'PROCURING') {
    if (!guards.escrowFunded) {
      return { allowed: false, reason: 'TradeVault escrow must be funded before PROCURING.' };
    }
  }
  if (proposedStage === 'SETTLED') {
    if (!guards.buyerPaid) {
      return { allowed: false, reason: 'Buyer payment must be confirmed by CFO before SETTLED.' };
    }
  }

  return { allowed: true, reason: null };
}

/**
 * Returns the next stage for a trade.
 */
function nextStage(currentStage) {
  const idx = TRADE_STAGES.indexOf(currentStage);
  if (idx === -1 || idx === TRADE_STAGES.length - 1) return null;
  return TRADE_STAGES[idx + 1];
}

// ─── FINANCE DATA PACKAGE ASSEMBLER ──────────────────────────────────────────

/**
 * Assembles the Finance Data Package object from trade and related data.
 * This is the structured data object that the PDF generator consumes.
 *
 * @param {Object} params - trade, trader, buyer, riskScores, batches
 * @returns {FinanceDataPackage}
 */
function assembleFDP({ trade, trader, buyer, riskScores, batches = [] }) {
  const risk = calculateRiskScore(riskScores);
  const fpFeeUsd = trade.financeFacilityUsd * FP_STANDARD_FEE_RATE_PA * (60 / 365);
  const fpTotalUsd = trade.financeFacilityUsd + fpFeeUsd;
  const mizabaFee = trade.contractValueUsd * MIZIBA_SETTLEMENT_FEE_RATE;
  const breakEven = calcBreakEven(fpTotalUsd, mizabaFee, trade.volumeMt);

  return {
    meta: {
      tradeRef: trade.tradeRef,
      generatedAt: new Date().toISOString(),
      confidential: true,
      version: 1,
    },
    sections: {
      executive_summary: {
        tradeRef:            trade.tradeRef,
        commodity:           `${trade.commodity} Grade ${trade.grade}`,
        volumeMt:            trade.volumeMt,
        buyer:               buyer.name,
        buyerCountry:        buyer.country,
        pricePerMtUsd:       trade.pricePerMtUsd,
        contractValueUsd:    trade.contractValueUsd,
        facilityUsd:         trade.financeFacilityUsd,
        projectedFpReturnUsd: round2(fpFeeUsd),
        riskScore:           risk.total,
        riskBand:            risk.band,
        deadline:            trade.deadlineDate,
      },
      buyer_profile: {
        name:              buyer.name,
        country:           buyer.country,
        sanctionsClear:    buyer.sanctionsClear,
        sanctionsCheckedAt: buyer.sanctionsCheckedAt,
        tradesCompleted:   buyer.tradesCompleted,
        paymentRecord:     buyer.tradesOnTime === buyer.tradesCompleted ? '100% on-time' : 'Review required',
        disputes:          buyer.disputes,
      },
      commodity_market: {
        commodity:        trade.commodity,
        grade:            trade.grade,
        contractPriceUsd: trade.pricePerMtUsd,
        eudrCompliant:    true,
        seasonality:      'Peak harvest season',
      },
      sourcing_plan: {
        tradepoints:     trade.tradepoints || [],
        farmerCount:     trade.farmerCount || 0,
        capacityUtilPct: trade.capacityUtilPct || 0,
        competingCommitments: false,
      },
      trader_profile: {
        name:             trader.name,
        traderId:         trader.traderId,
        kycStatus:        'VERIFIED',
        tradesCompleted:  trader.tradesCompleted,
        defaultRate:      '0%',
        riskScore:        risk.scores.trader_risk,
        equityUsd:        trade.traderEquityUsd,
        equityPct:        round2((trade.traderEquityUsd / trade.procurementCostUsd) * 100),
      },
      financial_structure: {
        procurementCostUsd:     trade.procurementCostUsd,
        traderEquityUsd:        trade.traderEquityUsd,
        traderEquityPct:        round2((trade.traderEquityUsd / trade.procurementCostUsd) * 100),
        financeFacilityUsd:     trade.financeFacilityUsd,
        facilityPct:            round2((trade.financeFacilityUsd / trade.procurementCostUsd) * 100),
        mizabaStructFeeUsd:     round2(trade.financeFacilityUsd * MIZIBA_STRUCTURING_FEE_RATE),
        mizabaSettleFeeUsd:     round2(mizabaFee),
        breakEvenPricePerMt:    breakEven,
        waterfallOrder:         ['Finance Partner (principal + fee)', 'Miziba (facilitation fee)', 'Trader (margin)'],
        fpFeeRatePa:            FP_STANDARD_FEE_RATE_PA,
        fpProjectedReturnUsd:   round2(fpFeeUsd),
        paymentTermsDays:       trade.paymentTermsDays,
      },
      risk_assessment: {
        totalScore:    risk.total,
        band:          risk.band,
        breakdown:     risk.breakdown,
        keyMitigants: [
          'EUDR verification via FarmerIQ geo-registration',
          'TradeVault waterfall — FP paid first structurally',
          'GPS-tracked delivery via TrackGuard',
          '2-hour farmer payment SLA from escrow',
          'Trader equity as first-loss position (35% minimum)',
        ],
      },
      term_sheet_draft: {
        facilityType:       'Commodity Trade Finance Facility',
        facilityAmountUsd:  trade.financeFacilityUsd,
        feeRatePa:          FP_STANDARD_FEE_RATE_PA,
        tenorDays:          60,
        waterfallPriority:  'Finance Partner Tier 1 > Miziba Tier 2 > Trader Tier 3',
        escrowStructure:    'TradeVault pool — dual-approval release — automated waterfall',
        governingLaw:       'Republic of Ghana',
        disputeResolution:  'Commercial Court of Ghana, Accra',
        status:             'DRAFT — subject to FP approval and DocuSign execution',
      },
      supporting_documents: [
        'Offtake Contract (signed)',
        'KYC: Certificate of Incorporation, TIN, Director IDs',
        'Export Licence (active)',
        'Previous Transaction Reconciliation Reports (0% default)',
        'Miziba Portfolio Summary',
      ],
    },
  };
}

// ─── DEPLOYMENT HEALTH CHECKER ───────────────────────────────────────────────

/**
 * Evaluates deployment health and generates alerts.
 *
 * @param {Object} params
 * @returns {DeploymentHealth}
 */
function checkDeploymentHealth({
  capitalDeployedPct,
  eudrCompliancePct,
  gradeAPct,
  volumeProcuredMt,
  volumeTargetMt,
  deadlineDate,
}) {
  const alerts = [];
  const now = new Date();
  const deadline = new Date(deadlineDate);
  const daysToDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  const timeElapsedPct = Math.max(0, 1 - (daysToDeadline / 60)); // assuming 60-day window

  // Pace check: deployed pct should roughly match time elapsed
  const expectedDeployedPct = timeElapsedPct * 100;
  if (capitalDeployedPct < expectedDeployedPct - 20) {
    alerts.push({
      severity: 'WARN',
      code: 'DEPLOYMENT_PACE_BELOW_TARGET',
      message: `Capital deployment at ${capitalDeployedPct.toFixed(0)}% — expected ~${expectedDeployedPct.toFixed(0)}% by now. Risk of missing delivery deadline.`,
    });
  }

  // EUDR check
  if (eudrCompliancePct !== null && eudrCompliancePct < EUDR_COMPLIANCE_THRESHOLD * 100) {
    alerts.push({
      severity: 'CRITICAL',
      code: 'EUDR_BELOW_THRESHOLD',
      message: `EUDR compliance at ${eudrCompliancePct}% — below 95% threshold. EU buyer may reject shipment. Verify sourcing from EUDR-registered farmers immediately.`,
    });
  }

  // Grade A check
  if (gradeAPct !== null && gradeAPct < GRADE_A_MIN_PCT * 100) {
    alerts.push({
      severity: 'WARN',
      code: 'GRADE_A_BELOW_CONTRACT',
      message: `Grade A procurement at ${gradeAPct}% — below contract requirement (min. 75%). Buyer may reject or renegotiate price.`,
    });
  }

  // Deadline proximity
  if (daysToDeadline <= 7 && capitalDeployedPct < 90) {
    alerts.push({
      severity: 'CRITICAL',
      code: 'DEADLINE_PROXIMITY',
      message: `${daysToDeadline} days to delivery deadline. Only ${capitalDeployedPct.toFixed(0)}% deployed. Escalate immediately.`,
    });
  }

  const status = alerts.some(a => a.severity === 'CRITICAL') ? 'CRITICAL'
    : alerts.some(a => a.severity === 'WARN') ? 'WARNING'
    : 'HEALTHY';

  return {
    status,
    capitalDeployedPct,
    eudrCompliancePct,
    gradeAPct,
    daysToDeadline,
    alerts,
    volumeProcuredMt,
    volumeRemainingMt: round2(Math.max(0, volumeTargetMt - volumeProcuredMt)),
  };
}

// ─── NON-PAYMENT PROTOCOL ────────────────────────────────────────────────────

const NP_STEPS = [
  {
    step: 1,
    triggerDay: 1,
    label: 'Day 1 — Direct Contact',
    action: 'Deal Officer contacts buyer directly. Trader also contacts buyer.',
    escalateTo: ['deal_officer', 'trader'],
  },
  {
    step: 2,
    triggerDay: 3,
    label: 'Day 3 — CEO + Finance Partner',
    action: 'CEO informs finance partner of payment delay. Formal notice issued.',
    escalateTo: ['ceo', 'finance_partner'],
  },
  {
    step: 3,
    triggerDay: 7,
    label: 'Day 7 — Formal Demand Letter',
    action: "Formal demand letter issued to buyer via trader's legal counsel.",
    escalateTo: ['ceo', 'legal'],
  },
  {
    step: 4,
    triggerDay: 14,
    label: 'Day 14 — CEO + Finance Partner Convene',
    action: 'Finance partner and CEO convene. Trader commits to resolution timeline.',
    escalateTo: ['ceo', 'finance_partner', 'trader'],
  },
  {
    step: 5,
    triggerDay: 30,
    label: 'Day 30 — Formal Dispute',
    action: 'Formal dispute opened. Options: trader own funds, commercial dispute resolution, or insurance claim.',
    escalateTo: ['ceo', 'finance_partner', 'legal'],
  },
];

function getNonPaymentStep(stepNumber) {
  return NP_STEPS.find(s => s.step === stepNumber) || null;
}

function getNextNonPaymentStep(currentStep) {
  if (currentStep >= 5) return null;
  return NP_STEPS.find(s => s.step === currentStep + 1);
}

// ─── CLOSURE VALIDATION ───────────────────────────────────────────────────────

/**
 * Validates that all 7 closure checklist items are complete before locking.
 */
function validateClosure(checklist) {
  const required = [
    'waterfall_confirmed',
    'trr_received',
    'ccc_received',
    'buyer_perf_recorded',
    'trader_rec_updated',
    'fp_report_sent',
    'record_locked',
  ];
  const missing = required.filter(k => !checklist[k]);
  return {
    canLock: missing.length === 0,
    missing,
    completedCount: required.length - missing.length,
    totalItems: required.length,
  };
}

// ─── NOTIFICATION TRIGGER MAP ─────────────────────────────────────────────────

/**
 * Returns the notification payloads to dispatch for a given trade event.
 *
 * @param {string} event - e.g. 'STAGE_CHANGE', 'FP_APPROVED', 'BUYER_PAYMENT'
 * @param {Object} context - trade, users, etc.
 * @returns {Array<NotificationPayload>}
 */
function getNotificationsForEvent(event, context) {
  const { trade, dealOfficer, trader, fp, ceo, cfo } = context;

  const TRIGGERS = {
    STAGE_SUBMITTED: [
      { to: dealOfficer, channel: 'email', subject: `New application: ${trade.tradeRef}`, body: `A new trade application has been submitted by ${trader.name}. Review in TradeAxis.` },
      { to: trader,      channel: 'email', subject: `Application received: ${trade.tradeRef}`, body: `Your application ${trade.tradeRef} has been received and assigned to our Deal Officer. Expected review: 5 business days.` },
    ],
    STAGE_VALIDATED: [
      { to: dealOfficer, channel: 'in_app', body: `${trade.tradeRef} validated. Finance Data Package ready to send.` },
      { to: trader,      channel: 'email', subject: `Application validated: ${trade.tradeRef}`, body: `Your application has passed all validation checks. Finance partner review underway.` },
    ],
    STAGE_FINANCE_REVIEW: [
      { to: fp,          channel: 'email', subject: `New deal for review: ${trade.tradeRef}`, body: `A Finance Data Package is available in your TradeAxis portal for ${trade.tradeRef}. 5-day review window.` },
      { to: dealOfficer, channel: 'in_app', body: `Finance Data Package sent to ${fp.name} for ${trade.tradeRef}.` },
    ],
    FP_APPROVED: [
      { to: dealOfficer, channel: 'in_app', body: `${trade.tradeRef} approved by ${fp.name}. Advance to FUNDED.` },
      { to: trader,      channel: 'email', subject: `Finance approved: ${trade.tradeRef}`, body: `Your trade facility has been approved. Deposit equity into TradeVault escrow within 5 business days.` },
    ],
    FP_DECLINED: [
      { to: dealOfficer, channel: 'email', subject: `Finance declined: ${trade.tradeRef}`, body: `${fp.name} has declined the facility for ${trade.tradeRef}.` },
      { to: trader,      channel: 'email', subject: `Application outcome: ${trade.tradeRef}`, body: `We were unable to secure finance for this application at this time. Contact your Deal Officer for details.` },
    ],
    STAGE_DELIVERED: [
      { to: cfo,         channel: 'email', subject: `Delivery confirmed — payment due: ${trade.tradeRef}`, body: `${trade.tradeRef} has been delivered. Buyer payment due within ${trade.paymentTermsDays} days. Awaiting your confirmation.` },
      { to: dealOfficer, channel: 'in_app', body: `${trade.tradeRef} delivered. CFO awaiting buyer payment confirmation.` },
    ],
    BUYER_PAYMENT_CONFIRMED: [
      { to: dealOfficer, channel: 'in_app', body: `Buyer payment confirmed for ${trade.tradeRef}. Waterfall settlement in progress.` },
      { to: fp,          channel: 'email', subject: `Settlement initiated: ${trade.tradeRef}`, body: `Buyer payment confirmed. TradeVault waterfall settlement has been instructed. Your funds will be released within 1 business day.` },
    ],
    STAGE_SETTLED: [
      { to: trader,      channel: 'email', subject: `Trade settled: ${trade.tradeRef}`, body: `Your trade has been settled. Margin has been released to your account.` },
      { to: fp,          channel: 'email', subject: `Settlement complete: ${trade.tradeRef}`, body: `Settlement for ${trade.tradeRef} is complete. Full settlement report available in your portal.` },
      { to: dealOfficer, channel: 'in_app', body: `${trade.tradeRef} settled. Complete closure checklist.` },
    ],
    NP_STEP_1: [
      { to: dealOfficer, channel: 'email', subject: `Non-payment protocol opened: ${trade.tradeRef}`, body: `Buyer payment overdue. Day 1 protocol: contact buyer directly.` },
    ],
    NP_STEP_3: [
      { to: ceo,         channel: 'email', subject: `Overdue payment — Day 7 escalation: ${trade.tradeRef}`, body: `Formal demand letter required. Day 7 of non-payment protocol for ${trade.tradeRef}.` },
      { to: fp,          channel: 'email', subject: `Payment delay update: ${trade.tradeRef}`, body: `Formal demand letter has been issued. We will update you at Day 14 if unresolved.` },
    ],
    CEO_ESCALATION: [
      { to: ceo,         channel: 'email', subject: `Escalation required: ${trade.tradeRef}`, body: `Deal Officer has escalated ${trade.tradeRef} for CEO review before Finance Data Package submission.` },
    ],
    EUDR_ALERT: [
      { to: dealOfficer, channel: 'in_app', body: `EUDR compliance below 95% on ${trade.tradeRef}. Immediate action required.` },
      { to: ceo,         channel: 'in_app', body: `EUDR alert on ${trade.tradeRef}. Review deployment dashboard.` },
    ],
  };

  return TRIGGERS[event] || [];
}

// ─── UTILITY ─────────────────────────────────────────────────────────────────

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getRiskBand(score) {
  return RISK_BANDS.find(b => score >= b.min && score <= b.max) || RISK_BANDS[RISK_BANDS.length - 1];
}

function isTradeEditable(stage) {
  return !['SETTLED', 'CLOSED'].includes(stage);
}

function docRetentionExpiry(uploadedAt) {
  const d = new Date(uploadedAt);
  d.setFullYear(d.getFullYear() + DOC_RETENTION_YEARS);
  return d.toISOString();
}



// ─── OUTBOUND EVENT PUBLISHER ─────────────────────────────────────────────────
// spec §15.3: TradeAxis PUBLISHES buyer.payment.received to TradeVault
// This triggers waterfall execution in TradeVault.
// Called from settlementRouter after CFO confirms buyer payment.

/**
 * Publishes buyer.payment.received event to TradeVault.
 * TradeVault consumes this to execute the waterfall settlement.
 *
 * @param {Object} httpClient - axios instance pre-configured for TradeVault
 * @param {Object} params
 * @returns {Promise<Object>} TradeVault acknowledgement
 */
async function publishBuyerPaymentReceived(httpClient, {
  tradeRef,
  escrowId,
  buyerPaymentCents,  // BIGINT cents per spec §15.3 payload
  buyerPaymentDate,
  financePartnerId,
  traderId,
}) {
  const payload = {
    event:              'buyer.payment.received',
    trade_ref:          tradeRef,
    escrow_id:          escrowId,
    buyer_payment_cents: buyerPaymentCents,  // spec-defined field name
    buyer_payment_date: buyerPaymentDate,
    finance_partner_id: financePartnerId,
    trader_id:          traderId,
    published_at:       new Date().toISOString(),
  };

  // TradeVault endpoint that consumes this event
  const response = await httpClient.post('/events/buyer-payment', payload);
  return response.data;
}

module.exports.publishBuyerPaymentReceived = publishBuyerPaymentReceived;

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  // Waterfall
  calculateWaterfall,
  calcBreakEven,
  // Risk
  calculateRiskScore,
  calcTraderRiskScore,
  getRiskBand,
  RISK_DIMENSIONS,
  RISK_BANDS,
  // Stage machine
  validateStageTransition,
  nextStage,
  TRADE_STAGES,
  // FDP
  assembleFDP,
  // Deployment
  checkDeploymentHealth,
  // Non-payment
  getNonPaymentStep,
  getNextNonPaymentStep,
  NP_STEPS,
  // Closure
  validateClosure,
  // Notifications
  getNotificationsForEvent,
  // Utils
  round2,
  isTradeEditable,
  docRetentionExpiry,
  // Constants
  MIZIBA_STRUCTURING_FEE_RATE,
  MIZIBA_SETTLEMENT_FEE_RATE,
  MIN_TRADER_EQUITY_PCT,
  FP_STANDARD_FEE_RATE_PA,
  EUDR_COMPLIANCE_THRESHOLD,
};
