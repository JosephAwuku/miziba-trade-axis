export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { User } from '@/lib/types';
import { isDeployedTradeStage } from '@/lib/portfolio-metrics';

// GET /api/portfolio — Get aggregated metrics for dashboard
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const typedUser: User = auth.profile as User;

    const admin = supabaseAdmin;

    // Base query for trades
    let query = admin.from('trades').select('*');

    // Filter by org if not internal staff
    const internalRoles = ['ceo', 'cfo', 'deal_officer', 'ops_admin'];
    if (!internalRoles.includes(typedUser.role as string)) {
      if (typedUser.role === 'trader') {
        query = query.eq('trader_org_id', typedUser.org_id);
      } else if (typedUser.role === 'finance_partner') {
        query = query.eq('fp_org_id', typedUser.org_id);
      }
    }

    const { data: trades, error: tradesError } = await query;

    if (tradesError) {
      console.error('Portfolio metrics fetch error:', tradesError);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    // Accumulators
    let total_contract_value_usd = 0;
    let finance_facility_pipeline_usd = 0;
    let capital_deployed_usd = 0;
    let total_volume_mt = 0;
    let total_risk_score = 0;
    let risk_score_count = 0;
    
    const stage_distribution: Record<string, number> = {};
    const commodity_breakdown: Record<string, number> = {};
    const countries = new Set<string>();

    trades?.forEach((t: any) => {
      const trade = t as any;
      total_contract_value_usd += trade.contract_value_usd || 0;
      const facility = trade.finance_facility_usd || 0;
      if (isDeployedTradeStage(trade.stage)) {
        capital_deployed_usd += facility;
      } else {
        finance_facility_pipeline_usd += facility;
      }
      total_volume_mt += trade.volume_mt || 0;
      
      if (trade.risk_score) {
        total_risk_score += trade.risk_score;
        risk_score_count++;
      }

      stage_distribution[trade.stage] = (stage_distribution[trade.stage] || 0) + 1;
      commodity_breakdown[trade.commodity] = (commodity_breakdown[trade.commodity] || 0) + (trade.contract_value_usd || 0);
      
      if (trade.buyer_country) {
        countries.add(trade.buyer_country);
      }
    });

    const metrics = {
      total_deals: trades?.length || 0,
      total_contract_value_usd,
      finance_facility_pipeline_usd,
      capital_deployed_usd,
      /** @deprecated use finance_facility_pipeline_usd + capital_deployed_usd */
      total_facility_usd: finance_facility_pipeline_usd + capital_deployed_usd,
      avg_risk_score: risk_score_count > 0 ? total_risk_score / risk_score_count : 0,
      default_rate_pct: 0, // In reality, calculate from SETTLED/CLOSED trades with discrepancies
      avg_trade_cycle_days: 45, // Mock for now
      farmer_sla_compliance_pct: 94, // Mock
      weight_reconciliation_pct: 98, // Mock
      fp_return_min_pct: 8,
      fp_return_max_pct: 12,
      farmers_reached: (trades?.length || 0) * 12, // Approximation
      total_volume_mt,
      countries_active: countries.size,
      stage_distribution,
      commodity_breakdown,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('GET /api/portfolio error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
