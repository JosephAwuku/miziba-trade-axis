'use strict';

/**
 * TRADEAXIS — UNIT TESTS
 * Core business logic: waterfall, risk scoring, stage machine, closure
 *
 * Run: npm test
 */

const {
  calculateWaterfall,
  calcBreakEven,
  calculateRiskScore,
  calcTraderRiskScore,
  validateStageTransition,
  validateClosure,
  checkDeploymentHealth,
  getRiskBand,
  TRADE_STAGES,
} = require('../core/business-logic');

// ─── WATERFALL ENGINE ─────────────────────────────────────────────────────────

describe('calculateWaterfall', () => {
  const base = {
    buyerPaymentUsd: 174000,
    financeFacilityUsd: 81900,
    fpFeeRatePa: 0.12,
    tenorDays: 60,
    contractValueUsd: 174000,
  };

  test('FP receives principal + pro-rata fee', () => {
    const result = calculateWaterfall(base);
    const expectedFpFee = 81900 * 0.12 * (60 / 365);
    expect(result.fpFeeUsd).toBeCloseTo(expectedFpFee, 2);
    expect(result.fpPrincipalUsd).toBe(81900);
    expect(result.fpTotalUsd).toBeCloseTo(81900 + expectedFpFee, 2);
  });

  test('Finance partner is ALWAYS paid first', () => {
    const result = calculateWaterfall(base);
    expect(result.settlementOrder[0]).toBe('FP_PRINCIPAL');
    expect(result.settlementOrder[1]).toBe('FP_FEE');
  });

  test('Trader receives residual after FP and Miziba', () => {
    const result = calculateWaterfall(base);
    const expectedMiziba = 174000 * 0.005;
    const expectedTrader = 174000 - result.fpTotalUsd - expectedMiziba;
    expect(result.mizabaFeeUsd).toBeCloseTo(expectedMiziba, 2);
    expect(result.traderMarginUsd).toBeCloseTo(expectedTrader, 2);
  });

  test('Shortfall scenario — FP still paid first from available funds', () => {
    const shortfallCase = {
      ...base,
      buyerPaymentUsd: 60000,  // Less than FP claim
    };
    const result = calculateWaterfall(shortfallCase);
    expect(result.shortfall).toBe(true);
    expect(result.traderMarginUsd).toBeLessThan(0);
    // FP gets up to their full claim
    expect(result.fpTotalUsd).toBeLessThanOrEqual(result.fpPrincipalUsd + result.fpFeeUsd);
    // Trader cannot receive more than FP when FP not fully paid
    expect(result.fpTotalUsd).toBeGreaterThanOrEqual(result.traderMarginUsd + result.mizabaFeeUsd);
  });

  test('Throws on zero buyer payment', () => {
    expect(() => calculateWaterfall({ ...base, buyerPaymentUsd: 0 })).toThrow('WATERFALL_ERROR');
  });

  test('Throws on zero facility', () => {
    expect(() => calculateWaterfall({ ...base, financeFacilityUsd: 0 })).toThrow('WATERFALL_ERROR');
  });
});

describe('calcBreakEven', () => {
  test('Returns correct break-even price per MT', () => {
    const fpTotal = 85516;  // 81900 + fee
    const mizabaFee = 870;
    const volumeMt = 120;
    const result = calcBreakEven(fpTotal, mizabaFee, volumeMt);
    expect(result).toBeCloseTo((fpTotal + mizabaFee) / volumeMt, 2);
  });

  test('Throws on zero volume', () => {
    expect(() => calcBreakEven(85000, 870, 0)).toThrow();
  });
});

// ─── RISK SCORING ─────────────────────────────────────────────────────────────

describe('calculateRiskScore', () => {
  const lowRisk = {
    buyer_risk: 25,
    trader_risk: 25,
    commodity_price_risk: 20,
    sourcing_supply_risk: 15,
    logistics_delivery_risk: 15,
  };

  const moderateRisk = {
    buyer_risk: 15,
    trader_risk: 18,
    commodity_price_risk: 14,
    sourcing_supply_risk: 11,
    logistics_delivery_risk: 10,
  };

  test('Perfect score = 100, LOW_RISK, direct submission allowed', () => {
    const result = calculateRiskScore(lowRisk);
    expect(result.total).toBe(100);
    expect(result.band).toBe('LOW_RISK');
    expect(result.canSubmitDirect).toBe(true);
    expect(result.requiresCEO).toBe(false);
  });

  test('Moderate risk requires CEO review', () => {
    const result = calculateRiskScore(moderateRisk);
    expect(result.total).toBe(68);
    expect(result.band).toBe('MODERATE_RISK');
    expect(result.requiresCEO).toBe(true);
    expect(result.canSubmitDirect).toBe(false);
  });

  test('Score below 40 should decline', () => {
    const lowScore = { buyer_risk: 8, trader_risk: 6, commodity_price_risk: 8, sourcing_supply_risk: 6, logistics_delivery_risk: 3 };
    const result = calculateRiskScore(lowScore);
    expect(result.shouldDecline).toBe(true);
    expect(result.band).toBe('HIGH_RISK');
  });

  test('Throws on score exceeding dimension maximum', () => {
    expect(() => calculateRiskScore({ ...moderateRisk, buyer_risk: 30 })).toThrow('RISK_SCORING_ERROR');
  });

  test('Throws on missing dimension', () => {
    const { buyer_risk: _, ...incomplete } = moderateRisk;
    expect(() => calculateRiskScore(incomplete)).toThrow('RISK_SCORING_ERROR');
  });

  test('Breakdown contains all 5 dimensions', () => {
    const result = calculateRiskScore(moderateRisk);
    expect(result.breakdown).toHaveLength(5);
  });
});

describe('calcTraderRiskScore', () => {
  test('First-time trader with KYC and capital proof = 12', () => {
    const score = calcTraderRiskScore({ tradesCompleted: 0, tradesDefaulted: 0, kycVerified: true, hasCapitalProof: true });
    expect(score).toBe(12);
  });

  test('First-time, marginal KYC = 6', () => {
    const score = calcTraderRiskScore({ tradesCompleted: 0, tradesDefaulted: 0, kycVerified: true, hasCapitalProof: false });
    expect(score).toBe(6);
  });

  test('1 completed trade, 0 defaults = 18', () => {
    const score = calcTraderRiskScore({ tradesCompleted: 1, tradesDefaulted: 0, kycVerified: true, hasCapitalProof: true });
    expect(score).toBe(18);
  });

  test('3+ completed trades, 0 defaults = 25', () => {
    const score = calcTraderRiskScore({ tradesCompleted: 3, tradesDefaulted: 0, kycVerified: true, hasCapitalProof: true });
    expect(score).toBe(25);
  });

  test('Any default = 0 (immediate decline)', () => {
    const score = calcTraderRiskScore({ tradesCompleted: 5, tradesDefaulted: 1, kycVerified: true, hasCapitalProof: true });
    expect(score).toBe(0);
  });
});

// ─── STAGE MACHINE ────────────────────────────────────────────────────────────

describe('validateStageTransition', () => {
  test('SUBMITTED → UNDER_VALIDATION allowed', () => {
    const result = validateStageTransition('SUBMITTED', 'UNDER_VALIDATION');
    expect(result.allowed).toBe(true);
  });

  test('Cannot skip stages', () => {
    const result = validateStageTransition('SUBMITTED', 'VALIDATED');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('sequentially');
  });

  test('Cannot reverse stages', () => {
    const result = validateStageTransition('FUNDED', 'VALIDATED');
    expect(result.allowed).toBe(false);
  });

  test('CLOSED trade cannot be modified', () => {
    const result = validateStageTransition('CLOSED', 'SETTLED');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('immutable');
  });

  test('UNDER_VALIDATION → VALIDATED requires validation complete', () => {
    const resultFail = validateStageTransition('UNDER_VALIDATION', 'VALIDATED', { validationComplete: false });
    expect(resultFail.allowed).toBe(false);

    const resultOk = validateStageTransition('UNDER_VALIDATION', 'VALIDATED', { validationComplete: true });
    expect(resultOk.allowed).toBe(true);
  });

  test('FINANCE_REVIEW → FUNDED requires FP approval', () => {
    const resultFail = validateStageTransition('FINANCE_REVIEW', 'FUNDED', { fpApproved: false });
    expect(resultFail.allowed).toBe(false);

    const resultOk = validateStageTransition('FINANCE_REVIEW', 'FUNDED', { fpApproved: true });
    expect(resultOk.allowed).toBe(true);
  });

  test('DELIVERED → SETTLED requires buyer payment confirmed', () => {
    const resultFail = validateStageTransition('DELIVERED', 'SETTLED', { buyerPaid: false });
    expect(resultFail.allowed).toBe(false);

    const resultOk = validateStageTransition('DELIVERED', 'SETTLED', { buyerPaid: true });
    expect(resultOk.allowed).toBe(true);
  });

  test('All stages are in correct order', () => {
    expect(TRADE_STAGES[0]).toBe('SUBMITTED');
    expect(TRADE_STAGES[TRADE_STAGES.length - 1]).toBe('CLOSED');
  });
});

// ─── CLOSURE CHECKLIST ────────────────────────────────────────────────────────

describe('validateClosure', () => {
  const allComplete = {
    waterfall_confirmed: true,
    trr_received: true,
    ccc_received: true,
    buyer_perf_recorded: true,
    trader_rec_updated: true,
    fp_report_sent: true,
    record_locked: true,
  };

  test('All 7 complete → can lock', () => {
    const result = validateClosure(allComplete);
    expect(result.canLock).toBe(true);
    expect(result.completedCount).toBe(7);
    expect(result.missing).toHaveLength(0);
  });

  test('Missing items → cannot lock', () => {
    const incomplete = { ...allComplete, trr_received: false, fp_report_sent: false };
    const result = validateClosure(incomplete);
    expect(result.canLock).toBe(false);
    expect(result.missing).toContain('trr_received');
    expect(result.missing).toContain('fp_report_sent');
    expect(result.completedCount).toBe(5);
  });

  test('Empty checklist → cannot lock', () => {
    const result = validateClosure({});
    expect(result.canLock).toBe(false);
    expect(result.completedCount).toBe(0);
    expect(result.totalItems).toBe(7);
  });
});

// ─── DEPLOYMENT HEALTH ────────────────────────────────────────────────────────

describe('checkDeploymentHealth', () => {
  const healthyBase = {
    capitalDeployedPct: 70,
    eudrCompliancePct: 98,
    gradeAPct: 80,
    volumeProcuredMt: 38.5,
    volumeTargetMt: 55,
    deadlineDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  };

  test('Healthy deployment returns HEALTHY status', () => {
    const result = checkDeploymentHealth(healthyBase);
    expect(result.status).toBe('HEALTHY');
    expect(result.alerts).toHaveLength(0);
  });

  test('EUDR below 95% triggers CRITICAL alert', () => {
    const result = checkDeploymentHealth({ ...healthyBase, eudrCompliancePct: 88 });
    expect(result.status).toBe('CRITICAL');
    expect(result.alerts.some(a => a.code === 'EUDR_BELOW_THRESHOLD')).toBe(true);
  });

  test('Grade A below 75% triggers WARNING', () => {
    const result = checkDeploymentHealth({ ...healthyBase, gradeAPct: 70 });
    const alert = result.alerts.find(a => a.code === 'GRADE_A_BELOW_CONTRACT');
    expect(alert).toBeDefined();
    expect(alert.severity).toBe('WARN');
  });

  test('Near deadline with low deployment triggers CRITICAL', () => {
    const nearDeadline = {
      ...healthyBase,
      capitalDeployedPct: 40,
      deadlineDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
    };
    const result = checkDeploymentHealth(nearDeadline);
    expect(result.status).toBe('CRITICAL');
    expect(result.alerts.some(a => a.code === 'DEADLINE_PROXIMITY')).toBe(true);
  });
});

// ─── RISK BANDS ───────────────────────────────────────────────────────────────

describe('getRiskBand', () => {
  test('100 = LOW_RISK', () => expect(getRiskBand(100).label).toBe('LOW_RISK'));
  test('75 = LOW_RISK', () => expect(getRiskBand(75).label).toBe('LOW_RISK'));
  test('74 = MODERATE_RISK', () => expect(getRiskBand(74).label).toBe('MODERATE_RISK'));
  test('55 = MODERATE_RISK', () => expect(getRiskBand(55).label).toBe('MODERATE_RISK'));
  test('54 = ELEVATED_RISK', () => expect(getRiskBand(54).label).toBe('ELEVATED_RISK'));
  test('40 = ELEVATED_RISK', () => expect(getRiskBand(40).label).toBe('ELEVATED_RISK'));
  test('39 = HIGH_RISK', () => expect(getRiskBand(39).label).toBe('HIGH_RISK'));
  test('0 = HIGH_RISK', () => expect(getRiskBand(0).label).toBe('HIGH_RISK'));
});
