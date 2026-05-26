import { Trade, StageConfig, CommodityConfig, BatchItem, FPConfig, TradeSummary } from "./types";
import { apiClient } from "./api";

// Static configuration data (not from API)
export const ST: Record<string, StageConfig> = {
  SUBMITTED: { l: 'Submitted', c: '#8B0000', bg: '#FFF5F5', br: '#FECACA' },
  UNDER_VALIDATION: { l: 'Under Validation', c: '#8B0000', bg: '#FFF5F5', br: '#FECACA' },
  VALIDATED: { l: 'Validated', c: '#8B0000', bg: '#FFF5F5', br: '#FECACA' },
  FINANCE_REVIEW: { l: 'Finance Review', c: '#C2410C', bg: '#FFF7ED', br: '#FED7AA' },
  FUNDED: { l: 'Funded', c: '#8B0000', bg: '#FFF5F5', br: '#FECACA' },
  PROCURING: { l: 'Procuring', c: '#991B1B', bg: '#FEF2F2', br: '#FEE2E2' },
  DELIVERED: { l: 'Delivered', c: '#8B0000', bg: '#FFF5F5', br: '#FECACA' },
  SETTLED: { l: 'Settled', c: '#8B0000', bg: '#FFF5F5', br: '#FECACA' },
  CLOSED: { l: 'Closed', c: '#374151', bg: '#F9FAFB', br: '#D1D5DB' },
};

export const CMD: Record<string, CommodityConfig> = {
  cashew: { c: '#D97706', i: '●', l: 'Cashew' },
  shea: { c: '#7C3AED', i: '◆', l: 'Shea' },
  sesame: { c: '#DB2777', i: '▲', l: 'Sesame' },
  sorghum: { c: '#8B0000', i: '■', l: 'Sorghum' },
  soya: { c: '#8B0000', i: '◇', l: 'Soya' },
};

/** Display label for a commodity key (e.g. "shea" → "Shea"). */
export function commodityLabel(cmd: string | undefined | null): string {
  if (!cmd) return '';
  return CMD[cmd]?.l ?? cmd.charAt(0).toUpperCase() + cmd.slice(1);
}

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

