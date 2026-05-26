import { RiskDimension } from "./types";

export const RISK_DIMENSIONS: RiskDimension[] = [
  {
    key: 'buyer_risk',
    label: 'Buyer Creditworthiness',
    max: 25,
    weight: '25%',
    tiers: [
      { score: 25, label: 'S&P/Moody\'s Investment Grade, 5+ years history' },
      { score: 18, label: 'Unrated, 3+ years clean history, local bank ref' },
      { score: 12, label: 'New buyer, LC from Tier 1 bank' },
      { score: 6, label: 'New buyer, cash against docs or unconfirmed' },
      { score: 0, label: 'Sanctions hit or previous default' },
    ]
  },
  {
    key: 'trader_risk',
    label: 'Trader Track Record',
    max: 25,
    weight: '25%',
    tiers: [
      { score: 25, label: '3+ trades, 0% default rate' },
      { score: 18, label: '1–2 trades, 0% default rate' },
      { score: 12, label: 'First-time, strong KYC & capital proof' },
      { score: 6, label: 'First-time, marginal KYC or equity source' },
      { score: 0, label: 'Previous default — IMMEDIATE DECLINE' },
    ]
  },
  {
    key: 'commodity_price_risk',
    label: 'Commodity & Price Volatility',
    max: 20,
    weight: '20%',
    tiers: [
      { score: 20, label: 'Within 5% of benchmark, stable outlook' },
      { score: 14, label: 'Within 5–15% of benchmark' },
      { score: 8, label: 'Within 15–20% of benchmark' },
      { score: 0, label: '>20% deviation — High risk level' },
    ]
  },
  {
    key: 'sourcing_supply_risk',
    label: 'Sourcing & Supply Chain',
    max: 15,
    weight: '15%',
    tiers: [
      { score: 15, label: '<50% of 90-day regional capacity' },
      { score: 11, label: '50–80% of regional capacity' },
      { score: 6, label: '80–100% of regional capacity' },
      { score: 0, label: '>100% capacity — Likely not feasible' },
    ]
  },
  {
    key: 'logistics_delivery_risk',
    label: 'Logistics & Delivery',
    max: 15,
    weight: '15%',
    tiers: [
      { score: 15, label: 'Domestic, full TrackGuard coverage' },
      { score: 12, label: 'Export, TrackGuard Mode A (Port to Port)' },
      { score: 7, label: 'Cross-border, no GPS tracking' },
      { score: 3, label: 'No TrackGuard coverage available' },
    ]
  }
];

export const getRiskRecommendation = (total: number) => {
  if (total >= 75) return {
    label: 'Low Risk — Direct Submission',
    color: '#8B0000',
    bg: '#FFF5F5',
    border: '#FECACA',
    desc: 'Deal Officer may generate Finance Data Package and submit directly. Standard 5-day review window.'
  };
  if (total >= 55) return {
    label: 'Moderate Risk — CEO Review Required',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
    desc: 'Present to CEO before submitting. CEO can approve direct submission or require additional validation.'
  };
  if (total >= 40) return {
    label: 'Elevated Risk — CEO Must Approve',
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
    desc: 'CEO must approve. Additional due diligence: buyer verification, equity increase, sourcing plan review.'
  };
  return {
    label: 'High Risk — Decline Deal',
    color: '#991B1B',
    bg: '#FEF2F2',
    border: '#FECACA',
    desc: 'Deal should not proceed. Discuss with CEO. Trader may reapply with improvements.'
  };
};
