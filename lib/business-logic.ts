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
 * TypeScript version for Next.js integration
 */

import { Trade, RiskBreakdown, WaterfallInstruction } from './types';

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
] as const;

const RISK_DIMENSIONS = {
  buyer_risk: { max: 25, label: 'Buyer Risk' },
  trader_risk: { max: 25, label: 'Trader Risk' },
  commodity_price_risk: { max: 20, label: 'Commodity & Price' },
  sourcing_supply_risk: { max: 15, label: 'Sourcing & Supply' },
  logistics_delivery_risk: { max: 15, label: 'Logistics & Delivery' },
} as const;

const RISK_BANDS = [
  { min: 75, max: 100, label: 'LOW_RISK', action: 'DIRECT_SUBMISSION' },
  { min: 55, max: 74, label: 'MODERATE_RISK', action: 'CEO_REVIEW' },
  { min: 40, max: 54, label: 'ELEVATED_RISK', action: 'CEO_MUST_APPROVE' },
  { min: 0, max: 39, label: 'HIGH_RISK', action: 'DECLINE' },
] as const;

const MIZIBA_STRUCTURING_FEE_RATE = 0.0100; // 1.0% of facility
const MIZIBA_SETTLEMENT_FEE_RATE = 0.0050; // 0.5% of contract value
const MIN_TRADER_EQUITY_PCT = 0.35; // 35% of procurement cost
const FP_STANDARD_FEE_RATE_PA = 0.12; // 12% per annum
const EUDR_COMPLIANCE_THRESHOLD = 0.95; // 95% minimum
const GRADE_A_MIN_PCT = 0.75; // 75% minimum Grade A
const DOC_RETENTION_YEARS = 7;

// ─── WATERFALL ENGINE ────────────────────────────────────────────────────────

export interface WaterfallResult {
  buyerPaymentUsd: number;
  fpPrincipalUsd: number;
  fpFeeUsd: number;
  fpTotalUsd: number;
  mizabaFeeUsd: number;
  traderMarginUsd: number;
  tenorDays: number;
  fpFeeRatePa: number;
  shortfall: boolean;
  shortfallAmountUsd: number;
  breakEvenPricePerMt: number | null;
  settlementOrder: string[];
  instructions: any[];
  computedAt: string;
}

/**
 * Calculates the waterfall disbursement for a settled trade.
 */
export function calculateWaterfall({
  buyerPaymentUsd,
  financeFacilityUsd,
  fpFeeRatePa,
  tenorDays,
  contractValueUsd,
}: {
  buyerPaymentUsd: number;
  financeFacilityUsd: number;
  fpFeeRatePa: number;
  tenorDays: number;
  contractValueUsd: number;
}): WaterfallResult {
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
  let fpActualUsd = fpTotalUsd;
  let mizabaActualUsd = mizabaSettleFeeUsd;
  let traderActualUsd = traderMarginUsd;

  if (shortfall) {
    fpActualUsd = Math.min(buyerPaymentUsd, fpTotalUsd);
    mizabaActualUsd = Math.min(Math.max(0, buyerPaymentUsd - fpActualUsd), mizabaSettleFeeUsd);
    traderActualUsd = buyerPaymentUsd - fpActualUsd - mizabaActualUsd;
  }

  return {
    buyerPaymentUsd: round2(buyerPaymentUsd),
    fpPrincipalUsd: round2(financeFacilityUsd),
    fpFeeUsd: round2(fpFeeUsd),
    fpTotalUsd: round2(fpActualUsd),
    mizabaFeeUsd: round2(mizabaActualUsd),
    traderMarginUsd: round2(traderActualUsd),
    tenorDays,
    fpFeeRatePa,
    shortfall,
    shortfallAmountUsd: shortfall ? round2(Math.abs(traderMarginUsd)) : 0,
    breakEvenPricePerMt: null,
    settlementOrder: ['FP_PRINCIPAL', 'FP_FEE', 'MIZIBA_FEE', 'TRADER_MARGIN'],
    instructions: [],
    computedAt: new Date().toISOString(),
  };
}

/**
 * Break-even buyer price per MT.
 */
export function calcBreakEven(fpTotalUsd: number, mizabaFeeUsd: number, volumeMt: number): number {
  if (volumeMt <= 0) throw new Error('Volume must be positive.');
  return round2((fpTotalUsd + mizabaFeeUsd) / volumeMt);
}

// ─── RISK SCORING ENGINE ─────────────────────────────────────────────────────

export interface RiskScoringResult {
  scores: RiskBreakdown;
  baseTotal: number;
  bonusApplied: number;
  total: number;
  adjustments: Array<{ reason: string; points: number }>;
  band: string;
  action: string;
  canSubmitDirect: boolean;
  requiresCEO: boolean;
  shouldDecline: boolean;
  breakdown: Array<{
    dimension: string;
    label: string;
    score: number;
    max: number;
    pct: number;
  }>;
}

/**
 * Validates and scores a risk assessment submission.
 */
export function calculateRiskScore(scores: RiskBreakdown): RiskScoringResult {
  const errors: string[] = [];
  let total = 0;

  for (const [dim, cfg] of Object.entries(RISK_DIMENSIONS)) {
    const val = scores[dim as keyof RiskBreakdown] as number;
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

  const band = RISK_BANDS.find(b => total >= b.min && total <= b.max) || RISK_BANDS[RISK_BANDS.length - 1];

  const adjustedTotal = Math.max(0, Math.min(100, total));
  const adjBand = RISK_BANDS.find(b => adjustedTotal >= b.min && adjustedTotal <= b.max) || RISK_BANDS[RISK_BANDS.length - 1];

  return {
    scores,
    baseTotal: total,
    bonusApplied: 0,
    total: adjustedTotal,
    adjustments: [],
    band: adjBand.label,
    action: adjBand.action,
    canSubmitDirect: adjBand.action === 'DIRECT_SUBMISSION',
    requiresCEO: ['CEO_REVIEW', 'CEO_MUST_APPROVE'].includes(adjBand.action),
    shouldDecline: adjBand.action === 'DECLINE',
    breakdown: Object.entries(RISK_DIMENSIONS).map(([k, cfg]) => {
      const score = (scores as any)[k] || 0;
      return {
        dimension: k,
        label: cfg.label,
        score,
        max: (cfg as any).max,
        pct: Math.round((score / (cfg as any).max) * 100),
      };
    }),
  };
}

// RiskBreakdown is now imported from types.ts

/**
 * Calculates a risk breakdown from trade data for display purposes.
 * This is a simplified version for the API when no detailed risk assessment exists.
 */
export function calculateRiskBreakdown(trade: any): RiskBreakdown {
  // Simple risk calculation based on trade data
  const traderOrgKyc =
    trade.trader_org_kyc_status || trade.organisations?.kyc_status || trade.kyc_status;
  const buyerRisk = 10;
  const traderRisk = traderOrgKyc === 'VERIFIED' ? 5 : 15;
  const commodityRisk = ['cashew', 'sesame'].includes(trade.commodity?.toLowerCase()) ? 5 : 12;
  const sourcingRisk = trade.volume_mt > 1000 ? 8 : 5;
  const logisticsRisk = trade.delivery_point ? 5 : 10;

  const overall = buyerRisk + traderRisk + commodityRisk + sourcingRisk + logisticsRisk;

  return {
    buyer_risk: buyerRisk,
    trader_risk: traderRisk,
    commodity_price_risk: commodityRisk,
    sourcing_supply_risk: sourcingRisk,
    logistics_delivery_risk: logisticsRisk
  };
}

// ─── TRADE STAGE MACHINE ─────────────────────────────────────────────────────

export interface StageTransitionResult {
  allowed: boolean;
  reason: string | null;
}

/**
 * Validates and returns the next allowed stage for a trade.
 * This function validates the business rules but expects database checks to be done by caller.
 */
export function validateStageTransition(
  currentStage: string,
  proposedStage: string,
  guards: {
    validationComplete?: boolean;
    riskScored?: boolean;
    ceoApproved?: boolean;
    fpApproved?: boolean;
    capitalDeployed?: boolean;
    goodsDelivered?: boolean;
    buyerPaid?: boolean;
    waterfallComplete?: boolean;
    closureComplete?: boolean;
  } = {}
): StageTransitionResult {
  const currentIdx = TRADE_STAGES.indexOf(currentStage as any);
  const proposedIdx = TRADE_STAGES.indexOf(proposedStage as any);

  if (currentIdx === -1) return { allowed: false, reason: `Unknown stage: ${currentStage}` };
  if (proposedIdx === -1) return { allowed: false, reason: `Unknown stage: ${proposedStage}` };
  if (currentStage === 'CLOSED') return { allowed: false, reason: 'CLOSED trade is immutable.' };
  if (proposedIdx !== currentIdx + 1) {
    return {
      allowed: false,
      reason: `Cannot transition from ${currentStage} to ${proposedStage}. Stages must advance sequentially.`,
    };
  }

  // Stage-specific guards with detailed requirements
  if (proposedStage === 'UNDER_VALIDATION') {
    // No guards needed - Deal Officer can always start validation
    return { allowed: true, reason: null };
  }

  if (proposedStage === 'VALIDATED') {
    if (!guards.validationComplete) {
      return { allowed: false, reason: 'All 5 validation items must be complete before advancing to VALIDATED.' };
    }
  }

  if (proposedStage === 'FINANCE_REVIEW') {
    if (!guards.validationComplete) {
      return {
        allowed: false,
        reason: 'All validation checks must be complete before Finance Review.',
      };
    }
    if (!guards.riskScored) {
      return { allowed: false, reason: 'Risk scoring must be complete before sending to Finance Review.' };
    }
    if (guards.ceoApproved === false) {
      return { allowed: false, reason: 'High-risk trades require CEO approval before Finance Review.' };
    }
  }

  if (proposedStage === 'FUNDED') {
    if (!guards.fpApproved) {
      return { allowed: false, reason: 'Finance Partner must approve before advancing to FUNDED.' };
    }
  }

  if (proposedStage === 'PROCURING') {
    if (!guards.capitalDeployed) {
      return { allowed: false, reason: 'Capital must be deployed (minimum 60%) before PROCURING.' };
    }
  }

  if (proposedStage === 'DELIVERED') {
    if (!guards.goodsDelivered) {
      return { allowed: false, reason: 'Goods delivery must be confirmed before DELIVERED stage.' };
    }
  }

  if (proposedStage === 'SETTLED') {
    if (!guards.buyerPaid) {
      return { allowed: false, reason: 'Buyer payment must be confirmed before SETTLED.' };
    }
    if (!guards.waterfallComplete) {
      return { allowed: false, reason: 'Waterfall settlement must be complete before SETTLED.' };
    }
  }

  if (proposedStage === 'CLOSED') {
    if (!guards.closureComplete) {
      return { allowed: false, reason: 'All 7 closure checklist items must be complete before CLOSED.' };
    }
  }

  return { allowed: true, reason: null };
}

/**
 * Returns the next stage for a trade.
 */
export function nextStage(currentStage: string): string | null {
  const idx = TRADE_STAGES.indexOf(currentStage as any);
  if (idx === -1 || idx === TRADE_STAGES.length - 1) return null;
  return TRADE_STAGES[idx + 1];
}

// ─── CLOSURE VALIDATION ───────────────────────────────────────────────────────

export interface ClosureValidationResult {
  canLock: boolean;
  missing: string[];
  completedCount: number;
  totalItems: number;
}

/**
 * Validates that all 7 closure checklist items are complete before locking.
 */
export function validateClosure(checklist: Record<string, boolean>): ClosureValidationResult {
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

// ─── UTILITY ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function getRiskBand(score: number): any {
  return RISK_BANDS.find(b => score >= b.min && score <= b.max);
}

export function isTradeEditable(stage: string): boolean {
  return !['SETTLED', 'CLOSED'].includes(stage);
}

export function docRetentionExpiry(uploadedAt: string): string {
  const d = new Date(uploadedAt);
  d.setFullYear(d.getFullYear() + DOC_RETENTION_YEARS);
  return d.toISOString();
}

// ─── STAGE GUARDS (DATABASE CHECKS) ──────────────────────────────────────────

/**
 * Checks database to verify all conditions for stage transition are met.
 * Returns guards object to be passed to validateStageTransition.
 */
export async function checkStageTransitionGuards(
  supabaseClient: any,
  tradeId: string,
  proposedStage: string
): Promise<{
  validationComplete?: boolean;
  riskScored?: boolean;
  ceoApproved?: boolean;
  fpApproved?: boolean;
  capitalDeployed?: boolean;
  goodsDelivered?: boolean;
  buyerPaid?: boolean;
  waterfallComplete?: boolean;
  closureComplete?: boolean;
}> {
  const guards: any = {};

  // Check validation complete (all 5 items true)
  if (proposedStage === 'VALIDATED') {
    const { data: validation } = await supabaseClient
      .from('trade_validations')
      .select('buyer_verified, price_reasonable, sourcing_feasible, trader_qualified, margin_viable')
      .eq('trade_id', tradeId)
      .single();

    guards.validationComplete = validation
      ? validation.buyer_verified &&
        validation.price_reasonable &&
        validation.sourcing_feasible &&
        validation.trader_qualified &&
        validation.margin_viable
      : false;
  }

  // Validation + risk + CEO (Finance Review prerequisites)
  if (proposedStage === 'FINANCE_REVIEW') {
    const { data: validation } = await supabaseClient
      .from('trade_validations')
      .select('buyer_verified, price_reasonable, sourcing_feasible, trader_qualified, margin_viable')
      .eq('trade_id', tradeId)
      .single();

    guards.validationComplete = validation
      ? validation.buyer_verified &&
        validation.price_reasonable &&
        validation.sourcing_feasible &&
        validation.trader_qualified &&
        validation.margin_viable
      : false;

    const { data: riskScore } = await supabaseClient
      .from('trade_risk_scores')
      .select('total_score')
      .eq('trade_id', tradeId)
      .single();

    guards.riskScored = !!riskScore;

    // If high risk (score < 55), check CEO approval — must match FDP / risk routes
    if (riskScore && riskScore.total_score < 55) {
      const { data: escalation } = await supabaseClient
        .from('ceo_escalations')
        .select('decision')
        .eq('trade_id', tradeId)
        .single();

      guards.ceoApproved = escalation?.decision === 'approve_direct';
    } else {
      guards.ceoApproved = true; // Low/moderate risk doesn't need CEO approval
    }
  }

  // Check FP approval
  if (proposedStage === 'FUNDED') {
    const { data: fpDecision } = await supabaseClient
      .from('fp_decisions')
      .select('decision')
      .eq('trade_id', tradeId)
      .order('decided_at', { ascending: false })
      .limit(1)
      .single();

    guards.fpApproved = fpDecision?.decision === 'approve';
  }

  // Check capital deployed (at least 60%)
  if (proposedStage === 'PROCURING') {
    const { data: trade } = await supabaseClient
      .from('trades')
      .select('capital_deployed_pct')
      .eq('id', tradeId)
      .single();

    guards.capitalDeployed = trade ? trade.capital_deployed_pct >= 60 : false;
  }

  // Check goods delivered (volume_procured_mt or delivered_weight_mt set)
  if (proposedStage === 'DELIVERED') {
    const { data: trade } = await supabaseClient
      .from('trades')
      .select('delivered_weight_mt, volume_mt')
      .eq('id', tradeId)
      .single();

    guards.goodsDelivered = trade ? (trade.delivered_weight_mt || 0) > 0 : false;
  }

  // Check buyer payment confirmed
  if (proposedStage === 'SETTLED') {
    const { data: trade } = await supabaseClient
      .from('trades')
      .select('buyer_payment_usd, buyer_payment_date')
      .eq('id', tradeId)
      .single();

    guards.buyerPaid = trade ? !!trade.buyer_payment_usd && trade.buyer_payment_usd > 0 : false;

    // Dual CFO confirmation on waterfall (schema: both_confirmed / status)
    const { data: waterfall } = await supabaseClient
      .from('waterfall_instructions')
      .select('both_confirmed, status')
      .eq('trade_id', tradeId)
      .single();

    guards.waterfallComplete =
      !!waterfall &&
      (waterfall.both_confirmed === true ||
        ['INSTRUCTED', 'CONFIRMED'].includes(String(waterfall.status || '')));
  }

  // Check closure checklist complete
  if (proposedStage === 'CLOSED') {
    const { data: closure } = await supabaseClient
      .from('trade_closure_checklists')
      .select('waterfall_confirmed, trr_received, ccc_received, buyer_perf_recorded, trader_rec_updated, fp_report_sent, record_locked')
      .eq('trade_id', tradeId)
      .single();

    guards.closureComplete = closure
      ? closure.waterfall_confirmed &&
        closure.trr_received &&
        closure.ccc_received &&
        closure.buyer_perf_recorded &&
        closure.trader_rec_updated &&
        closure.fp_report_sent &&
        closure.record_locked
      : false;
  }

  return guards;
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

export {
  TRADE_STAGES,
  RISK_DIMENSIONS,
  RISK_BANDS,
  MIZIBA_STRUCTURING_FEE_RATE,
  MIZIBA_SETTLEMENT_FEE_RATE,
  MIN_TRADER_EQUITY_PCT,
  FP_STANDARD_FEE_RATE_PA,
  EUDR_COMPLIANCE_THRESHOLD,
  GRADE_A_MIN_PCT,
  DOC_RETENTION_YEARS,
};