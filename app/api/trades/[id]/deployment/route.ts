export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { User } from '@/lib/types';
import { notifyTradeParticipants } from '@/lib/notifications';

// PATCH /api/trades/[id]/deployment — Update capital deployment percentage
export async function PATCH(
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

    const typedUser: User = auth.profile as User;

    // Only Deal Officers, CEO, and CFO can update deployment
    if (!['deal_officer', 'ceo', 'cfo'].includes(typedUser.role as string)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const admin = supabaseAdmin;

    // Get trade info
    const { data: trade, error: tradeError } = await admin
      .from('trades')
      .select('stage, trade_ref, capital_deployed_pct')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    // Verify trade is in FUNDED stage
    if (trade.stage !== 'FUNDED') {
      return NextResponse.json({ 
        error: 'INVALID_STAGE', 
        message: 'Capital deployment can only be updated when trade is in FUNDED stage.' 
      }, { status: 400 });
    }

    const body = await request.json();
    const { capital_deployed_pct } = body;

    // Validate percentage
    if (capital_deployed_pct === undefined || capital_deployed_pct < 0 || capital_deployed_pct > 100) {
      return NextResponse.json({ error: 'INVALID_PERCENTAGE' }, { status: 400 });
    }

    // Update capital deployment
    const { error: updateError } = await admin
      .from('trades')
      .update({
        capital_deployed_pct,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tradeId);

    if (updateError) {
      console.error('Capital deployment update error:', updateError);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    // Notify if 60% threshold reached (can now advance to PROCURING)
    if (capital_deployed_pct >= 60 && trade.capital_deployed_pct < 60) {
      await notifyTradeParticipants(admin, trade, {
        subject: 'Capital Deployment Complete - Ready for Procurement',
        body: `Trade ${trade.trade_ref}: ${capital_deployed_pct}% capital deployed. Trade can now advance to PROCURING stage.`,
        type: 'DEPLOYMENT_COMPLETE',
        excludeUserId: typedUser.id,
      });
    }

    return NextResponse.json({
      success: true,
      capital_deployed_pct,
      can_advance_to_procuring: capital_deployed_pct >= 60,
      message: `Capital deployment updated to ${capital_deployed_pct}%.${capital_deployed_pct >= 60 ? ' Trade can now advance to PROCURING.' : ''}`,
    });
  } catch (error) {
    console.error('PATCH /api/trades/[id]/deployment error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// GET /api/trades/[id]/deployment — Get deployment status
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

    const { data: trade, error } = await admin
      .from('trades')
      .select('capital_deployed_pct, stage')
      .eq('id', tradeId)
      .single();

    if (error || !trade) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({
      capital_deployed_pct: trade.capital_deployed_pct || 0,
      can_advance_to_procuring: (trade.capital_deployed_pct || 0) >= 60,
    });
  } catch (error) {
    console.error('GET /api/trades/[id]/deployment error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
