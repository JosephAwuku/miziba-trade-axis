import { Trade, StageConfig, CommodityConfig, BatchItem, FPConfig, TradeSummary } from "./types";
import { apiClient } from "./api";

// Static configuration data (not from API)
export const ST: Record<string, StageConfig> = {
  SUBMITTED: { l: 'Submitted', c: '#2563EB', bg: '#EFF6FF', br: '#BFDBFE' },
  UNDER_VALIDATION: { l: 'Under Validation', c: '#B45309', bg: '#FFFBEB', br: '#FDE68A' },
  VALIDATED: { l: 'Validated', c: '#15803D', bg: '#F0FDF4', br: '#BBF7D0' },
  FINANCE_REVIEW: { l: 'Finance Review', c: '#C2410C', bg: '#FFF7ED', br: '#FED7AA' },
  FUNDED: { l: 'Funded', c: '#7C3AED', bg: '#F5F3FF', br: '#DDD6FE' },
  PROCURING: { l: 'Procuring', c: '#0369A1', bg: '#F0F9FF', br: '#BAE6FD' },
  DELIVERED: { l: 'Delivered', c: '#16A34A', bg: '#F0FDF4', br: '#BBF7D0' },
  SETTLED: { l: 'Settled', c: '#059669', bg: '#ECFDF5', br: '#A7F3D0' },
  CLOSED: { l: 'Closed', c: '#374151', bg: '#F9FAFB', br: '#D1D5DB' },
};

export const CMD: Record<string, CommodityConfig> = {
  cashew: { c: '#D97706', i: '●', l: 'Cashew' },
  shea: { c: '#7C3AED', i: '◆', l: 'Shea' },
  sesame: { c: '#DB2777', i: '▲', l: 'Sesame' },
  sorghum: { c: '#059669', i: '■', l: 'Sorghum' },
  soya: { c: '#2563EB', i: '◇', l: 'Soya' },
};

export const BATCH: BatchItem[] = [
  { id: 'B-038-01', fid: 'F-7821', tp: 'Kintampo North', wt: 1840, ghs: 9752, usd: 642, st: 'CONFIRMED', ts: '2026-03-28 07:14' },
  { id: 'B-038-02', fid: 'F-4493', tp: 'Techiman Central', wt: 2100, ghs: 11130, usd: 733, st: 'CONFIRMED', ts: '2026-03-28 09:41' },
  { id: 'B-038-03', fid: 'F-9012', tp: 'Kintampo South', wt: 1560, ghs: 8268, usd: 544, st: 'CONFIRMED', ts: '2026-03-29 08:05' },
  { id: 'B-038-04', fid: 'F-3341', tp: 'Wenchi Junction', wt: 2240, ghs: 11872, usd: 782, st: 'CONFIRMED', ts: '2026-03-29 11:22' },
  { id: 'B-038-05', fid: 'F-6678', tp: 'Kintampo North', wt: 1980, ghs: 10494, usd: 691, st: 'CONFIRMED', ts: '2026-03-30 07:58' },
  { id: 'B-038-06', fid: 'F-8823', tp: 'Techiman Central', wt: 2300, ghs: 12190, usd: 803, st: 'CONFIRMED', ts: '2026-03-30 10:34' },
  { id: 'B-038-07', fid: 'F-2210', tp: 'Wenchi Junction', wt: 1720, ghs: 9116, usd: 600, st: 'CONFIRMED', ts: '2026-03-31 08:12' },
  { id: 'B-038-08', fid: 'F-5589', tp: 'Kintampo South', wt: 2050, ghs: 10865, usd: 716, st: 'CONFIRMED', ts: '2026-03-31 14:03' },
  { id: 'B-038-09', fid: 'F-7104', tp: 'Techiman Central', wt: 1880, ghs: 9964, usd: 656, st: 'PENDING', ts: '2026-04-01 09:00' },
];

export const FPC: FPConfig[] = [
  { id: 'FP-001', name: 'Ecobank Ghana DFI Fund', contact: 'Kwame Asante-Boateng', email: 'k.asante@ecobank.com', trades: 5, approved: 4, capital: 268500, returned: 168000, avgReview: 3.2, health: 'green', nextCall: '2026-04-18' },
  { id: 'FP-002', name: 'Ghana Agric Dev Bank', contact: 'Abena Mensah-Twum', email: 'a.mensah@agribank.gh', trades: 3, approved: 3, capital: 82200, returned: 82200, avgReview: 4.1, health: 'green', nextCall: '2026-04-22' },
  { id: 'FP-003', name: 'Oikocredit West Africa', contact: 'Emmanuel Doku', email: 'e.doku@oikocredit.org', trades: 0, approved: 0, capital: 0, returned: 0, avgReview: null, health: 'amber', nextCall: '2026-04-15', onboarding: true },
];

// API-backed data functions (replace static TRADES)
export async function getTrades(params?: {
  stage?: string[];
  commodity?: string;
  fp_org_id?: string;
  trader_org_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
}): Promise<{ data: TradeSummary[]; total: number; page: number; per_page: number }> {
  return apiClient.getTrades(params);
}

export async function createTrade(trade: any): Promise<any> {
  return apiClient.createTrade(trade);
}

// Legacy static data for components that haven't been updated yet
// TODO: Remove once all components use API
export const TRADES: Trade[] = [];
