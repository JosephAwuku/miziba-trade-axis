export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { User, RiskAssessment } from '@/lib/types';
import { getRiskRecommendation } from '@/lib/risk-config';
import { notifyInternalRoles } from '@/lib/notifications';

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
    // In a real system, this would be a separate table. 
    // For this build, we store the score in the trades table and 
    // might mock or store the breakdown in a metadata/jsonb column if available.
    const { data: trade, error } = await admin
      .from('trades')
      .select('risk_score, risk_breakdown, trade_ref')
      .eq('id', tradeId)
      .single();

    if (error || !trade) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const typedTrade = trade as { risk_score: number; risk_breakdown: any; trade_ref: string };
    const score = typedTrade.risk_score || 0;
    const breakdown = typedTrade.risk_breakdown || {
      buyer_risk: 0,
      trader_risk: 0,
      commodity_price_risk: 0,
      sourcing_supply_risk: 0,
      logistics_delivery_risk: 0
    };

    const rec = getRiskRecommendation(score);

    const assessment: RiskAssessment = {
      id: `RA-${tradeId.substring(0, 8)}`,
      trade_id: tradeId,
      risk_score: score,
      breakdown: breakdown,
      recommendations: [rec.label, rec.desc],
      calculated_at: new Date().toISOString(),
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
    if (!auth || !['deal_officer', 'ceo', 'ops_admin'].includes(auth.profile.role as string)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json();
    const { risk_score, breakdown } = body;

    if (risk_score === undefined || !breakdown) {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    const admin = supabaseAdmin;
    
    // We update the main trades table with the new score and breakdown
    const { data: updated, error } = await (admin
      .from('trades') as any)
      .update({
        risk_score,
        risk_breakdown: breakdown,
        updated_at: new Date().toISOString()
      })
      .eq('id', tradeId)
      .select()
      .single();

    if (error) {
       // If risk_breakdown column doesn't exist, we might get an error.
       // In that case, we at least update the score.
       const { error: scoreOnlyError } = await (admin
        .from('trades') as any)
        .update({ risk_score })
        .eq('id', tradeId);
       
       if (scoreOnlyError) {
         console.error('Risk update error:', error);
         return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
       }
    }

    const rec = getRiskRecommendation(risk_score);

    // Notify internal roles (CEO, Ops) about risk update
    try {
      await notifyInternalRoles(admin, ['ceo', 'ops_admin'], {
        subject: 'Risk Assessment Updated',
        body: `Trade ${updated?.trade_ref || tradeId} risk score updated: ${risk_score}/100 (${rec.label}).`,
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
      }
    });

  } catch (error) {
    console.error('POST /api/trades/[id]/risk error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}