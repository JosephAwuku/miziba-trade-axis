export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { User, RiskAssessment } from '@/lib/types';
import { getRiskRecommendation } from '@/lib/risk-config';
import { notifyInternalRoles, notifyCeoAction } from '@/lib/notifications';

// GET /api/trades/[id]/risk — Get risk assessment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tradeId } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const admin = supabaseAdmin;
    
    // 1. Get the basic trade score
    const { data: trade, error: tradeError } = await admin
      .from('trades')
      .select('risk_score, trade_ref')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    // 2. Get the detailed breakdown from trade_risk_scores
    const { data: scoreDetails, error: detailsError } = await (admin
      .from('trade_risk_scores') as any)
      .select('*')
      .eq('trade_id', tradeId)
      .single();

    const score = trade.risk_score || 0;
    const breakdown = scoreDetails ? {
      buyer_risk: scoreDetails.buyer_risk,
      trader_risk: scoreDetails.trader_risk,
      commodity_price_risk: scoreDetails.commodity_price_risk,
      sourcing_supply_risk: scoreDetails.sourcing_supply_risk,
      logistics_delivery_risk: scoreDetails.logistics_delivery_risk
    } : {
      buyer_risk: 0,
      trader_risk: 0,
      commodity_price_risk: 0,
      sourcing_supply_risk: 0,
      logistics_delivery_risk: 0
    };

    const rec = getRiskRecommendation(score);

    const assessment: RiskAssessment = {
      id: scoreDetails?.id || `RA-${tradeId.substring(0, 8)}`,
      trade_id: tradeId,
      risk_score: score,
      breakdown: breakdown,
      notes: scoreDetails?.notes || '',
      recommendations: [rec.label, rec.desc],
      calculated_at: scoreDetails?.scored_at || new Date().toISOString(),
    };

    return NextResponse.json(assessment);
  } catch (error) {
    console.error('GET /api/trades/[id]/risk error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// POST /api/trades/[id]/risk — Save/Update risk assessment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tradeId } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth || !['deal_officer', 'ceo'].includes(auth.profile.role as string)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json();
    const { risk_score, breakdown, notes } = body;

    if (risk_score === undefined || !breakdown) {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    const admin = supabaseAdmin;
    const userId = auth.profile.id;

    const { data: tradeForRisk, error: tradeRiskFetchErr } = await admin
      .from('trades')
      .select('stage')
      .eq('id', tradeId)
      .single();

    if (tradeRiskFetchErr || !tradeForRisk) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    if (tradeForRisk.stage !== 'VALIDATED') {
      return NextResponse.json(
        {
          error: 'INVALID_STAGE',
          message:
            'Risk scoring is only allowed after the trade is VALIDATED (deal validation checklist complete).',
        },
        { status: 400 }
      );
    }
    
    // 1. Update the main trades table with the new score
    const { error: tradeUpdateError } = await (admin
      .from('trades') as any)
      .update({
        risk_score,
        updated_at: new Date().toISOString()
      })
      .eq('id', tradeId);

    if (tradeUpdateError) {
      console.error('Trade risk score update error:', tradeUpdateError);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    // 2. Upsert the detailed breakdown in trade_risk_scores
    const riskPayload = {
      trade_id: tradeId,
      buyer_risk: breakdown.buyer_risk || 0,
      trader_risk: breakdown.trader_risk || 0,
      commodity_price_risk: breakdown.commodity_price_risk || 0,
      sourcing_supply_risk: breakdown.sourcing_supply_risk || 0,
      logistics_delivery_risk: breakdown.logistics_delivery_risk || 0,
      notes: notes || '',
      scored_by: userId,
      scored_at: new Date().toISOString()
    };

    // Use upsert logic: try to update, if fail or no rows, insert
    const { data: existing } = await (admin
      .from('trade_risk_scores') as any)
      .select('id')
      .eq('trade_id', tradeId)
      .single();

    let detailError;
    if (existing) {
      const { error } = await (admin
        .from('trade_risk_scores') as any)
        .update(riskPayload)
        .eq('trade_id', tradeId);
      detailError = error;
    } else {
      const { error } = await (admin
        .from('trade_risk_scores') as any)
        .insert(riskPayload);
      detailError = error;
    }

    if (detailError) {
      console.error('Risk breakdown persistence error:', detailError);
      // We don't fail the whole request if the main score was saved, 
      // but we log it. However, for "saving in field" to work, this MUST succeed.
      return NextResponse.json({ error: 'BREAKDOWN_PERSISTENCE_FAILED' }, { status: 500 });
    }

    const rec = getRiskRecommendation(risk_score);

    // Get current trade stage and info
    const { data: tradeData } = await admin
      .from('trades')
      .select('stage, trade_ref, trader_org_id')
      .eq('id', tradeId)
      .single();

    // Check if CEO approval is needed (high risk = score < 55)
    const requiresCEOApproval = risk_score < 55;

    if (requiresCEOApproval && tradeData && tradeData.stage === 'VALIDATED') {
      // Create CEO escalation record
      const { error: escalationError } = await admin
        .from('ceo_escalations')
        .upsert({
          trade_id: tradeId,
          escalated_by: userId,
          escalated_at: new Date().toISOString(),
          reason: `High risk score: ${risk_score}/100. Requires CEO review before Finance Review.`,
        }, {
          onConflict: 'trade_id',
        });

      if (escalationError) {
        console.error('CEO escalation creation error:', escalationError);
      }

      // Notify CEO about escalation
      try {
        await notifyCeoAction(admin, {
          subject: 'HIGH RISK: CEO Approval Required',
          body: `Trade ${tradeData.trade_ref} has a risk score of ${risk_score}/100 and requires your approval before proceeding to Finance Review.`,
          type: 'CEO_ESCALATION',
          tradeId: tradeId,
        });
      } catch (notifErr) {
        console.error('CEO escalation notification failed:', notifErr);
      }
    }

    // Notify internal roles about risk update
    try {
      await notifyInternalRoles(admin, ['ceo', 'ops_admin'], {
        subject: 'Risk Assessment Updated',
        body: `Trade ${tradeData?.trade_ref || tradeId} risk score updated: ${risk_score}/100 (${rec.label}).${requiresCEOApproval ? ' CEO approval required.' : ''}`,
        type: 'RISK_UPDATE',
        tradeId: tradeId
      });
    } catch (notifErr) {
      console.error('Risk notification failed:', notifErr);
    }

    return NextResponse.json({
      success: true,
      assessment: {
        trade_id: tradeId,
        risk_score,
        breakdown,
        calculated_at: new Date().toISOString(),
        recommendations: [rec.label, rec.desc]
      },
      requires_ceo_approval: requiresCEOApproval,
      message: requiresCEOApproval 
        ? 'Risk assessment saved. CEO approval required before proceeding.'
        : 'Risk assessment saved. Trade can proceed to Finance Review.',
    });

  } catch (error) {
    console.error('POST /api/trades/[id]/risk error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}