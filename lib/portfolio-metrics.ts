/** Stages where finance facility counts as deployed capital (funded and beyond). */
export const DEPLOYED_TRADE_STAGES = [
  'FUNDED',
  'PROCURING',
  'DELIVERED',
  'SETTLED',
  'CLOSED',
] as const;

export function isDeployedTradeStage(stage: string): boolean {
  return (DEPLOYED_TRADE_STAGES as readonly string[]).includes(stage);
}

export function sumFacilityByDeployment(
  trades: Array<{ stage?: string; finance_facility_usd?: number; ff?: number }>,
  deployed: boolean
): number {
  return trades.reduce((sum, t) => {
    const stage = t.stage || '';
    const facility = t.finance_facility_usd ?? t.ff ?? 0;
    const isDeployed = isDeployedTradeStage(stage);
    if (deployed ? isDeployed : !isDeployed) {
      return sum + facility;
    }
    return sum;
  }, 0);
}
