/**
 * Display helpers separating company KYC from per-trade documents.
 */

export function resolveTraderOrgKycStatus(trade: {
  trader_org_kyc_status?: string | null;
  traderOrgKyc?: string | null;
  organisations?: { kyc_status?: string | null } | null;
  kyc_status?: string | null;
}): string {
  return (
    trade.trader_org_kyc_status ||
    trade.traderOrgKyc ||
    trade.organisations?.kyc_status ||
    trade.kyc_status ||
    'PENDING'
  );
}

export function formatTraderOrgKycLabel(status: string): string {
  if (status === 'VERIFIED') return 'Verified';
  return status.replace(/_/g, ' ');
}
