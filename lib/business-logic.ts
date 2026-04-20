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
  const buyerRisk = trade.kyc_status === 'VERIFIED' ? 5 : 15;
  const traderRisk = 10; // Default moderate risk
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
 */
export function validateStageTransition(
  currentStage: string,
  proposedStage: string,
  guards: {
    validationComplete?: boolean;
    fpApproved?: boolean;
    escrowFunded?: boolean;
    buyerPaid?: boolean;
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