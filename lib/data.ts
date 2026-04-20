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

// API-backed data functions
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

