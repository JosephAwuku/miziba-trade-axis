/** Map DB buyer row + nested trades to API list/detail shape. */
export function serializeBuyerRow(b: Record<string, unknown>, trades?: unknown[]) {
  const tradeList = (Array.isArray(trades) ? trades : (b.trades as unknown[]) || []) as Array<{
    stage?: string;
    contract_value_usd?: number;
    settled_at?: string | null;
  }>;
  const completedTrades = tradeList.filter((t) => t.stage === 'SETTLED');
  const score = (b.creditworthiness_score as number | null) ?? 70;
  const credit_rating =
    score >= 90 ? 'AAA' : score >= 80 ? 'AA' : score >= 70 ? 'A' : score >= 60 ? 'BBB' : 'BB';

  return {
    id: (b.id as string) || 'unknown',
    name: (b.name as string) || 'Unnamed Buyer',
    country: (b.country as string) || 'Unknown',
    registration_no: (b.registration_no as string | null) ?? null,
    notes: (b.notes as string | null) ?? null,
    sanctions_clear: Boolean(b.sanctions_clear),
    sanctions_checked_at: (b.sanctions_checked_at as string | null) ?? null,
    creditworthiness_score: score,
    credit_rating,
    trades_completed: completedTrades.length,
    trades_on_time: completedTrades.length,
    disputes: (b.disputes as number) || 0,
    total_volume_usd: completedTrades.reduce((sum, t) => sum + (t.contract_value_usd || 0), 0),
    last_trade_date: completedTrades[0]?.settled_at || null,
    created_at: b.created_at as string | undefined,
    updated_at: b.updated_at as string | undefined,
  };
}

export const CREDIT_RATING_TO_SCORE: Record<string, number> = {
  AAA: 95,
  AA: 85,
  A: 75,
  BBB: 65,
  BB: 55,
};
