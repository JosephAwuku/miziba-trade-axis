export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { User } from '@/lib/types';
import { notifyTradeParticipants } from '@/lib/notifications';

// POST /api/trades/[id]/ceo-decision — CEO approves or declines high-risk trade
export async function POST(
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

    // Only CEO can approve escalations
    if (typedUser.role !== 'ceo') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const admin = supabaseAdmin;

    // Get trade info
    const { data: trade, error: tradeError } = await admin
      .from('trades')
      .select('stage, trade_ref, risk_score')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    // Verify trade is in VALIDATED stage
    if (trade.stage !== 'VALIDATED') {
      return NextResponse.json({ 
        error: 'INVALID_STAGE', 
        message: 'Trade must be in VALIDATED stage for CEO decision.' 
      }, { status: 400 });
    }

    const body = await request.json();
    const { decision, notes } = body;

    // Validate decision
    if (!['approve_direct', 'require_validation', 'decline'].includes(decision)) {
      return NextResponse.json({ error: 'INVALID_DECISION' }, { status: 400 });
    }

    // Update or create CEO escalation record
    const { data: escalation, error: escalationError } = await admin
      .from('ceo_escalations')
      .upsert({
        trade_id: tradeId,
        escalated_by: typedUser.id,
        escalated_at: new Date().toISOString(),
        decision,
        decided_by: typedUser.id,
        decided_at: new Date().toISOString(),
        notes: notes || null,
      }, {
        onConflict: 'trade_id',
      })
      .select()
      .single();

    if (escalationError) {
      console.error('CEO decision update error:', escalationError);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    // Handle decision
    if (decision === 'approve_direct') {
      // Trade can now proceed - no stage change here, but FDP can be generated
      await notifyTradeParticipants(admin, trade, {
        subject: 'CEO Approved High-Risk Trade',
        body: `Trade ${trade.trade_ref} has been approved by the CEO and can proceed to Finance Review.`,
        type: 'CEO_APPROVED',
        excludeUserId: typedUser.id,
      });
    } else if (decision === 'decline') {
      // Mark trade as declined
      await admin
        .from('trades')
        .update({
          declined_at: new Date().toISOString(),
          declined_by: typedUser.id,
          decline_reason: notes || 'Declined by CEO due to high risk',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tradeId);

      await notifyTradeParticipants(admin, trade, {
        subject: 'Trade Declined by CEO',
        body: `Trade ${trade.trade_ref} was declined by the CEO. Reason: ${notes || 'High risk assessment'}`,
        type: 'CEO_DECLINED',
        excludeUserId: typedUser.id,
      });
    } else if (decision === 'require_validation') {
      await notifyTradeParticipants(admin, trade, {
        subject: 'CEO Requires Additional Validation',
        body: `Trade ${trade.trade_ref}: ${notes || 'Additional validation required before proceeding.'}`,
        type: 'CEO_VALIDATION_REQUIRED',
        excludeUserId: typedUser.id,
      });
    }

    return NextResponse.json({
      success: true,
      decision: escalation,
      message: decision === 'approve_direct' 
        ? 'Trade approved. Can proceed to Finance Review.' 
        : decision === 'decline'
        ? 'Trade declined.'
        : 'Additional validation required.',
    });
  } catch (error) {
    console.error('POST /api/trades/[id]/ceo-decision error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// GET /api/trades/[id]/ceo-decision — Get CEO escalation status
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

    // Get CEO escalation record if exists
    const { data: escalation, error } = await admin
      .from('ceo_escalations')
      .select(`
        *,
        escalated_by_user:users!ceo_escalations_escalated_by_fkey (
          full_name
        ),
        decided_by_user:users!ceo_escalations_decided_by_fkey (
          full_name
        )
      `)
      .eq('trade_id', tradeId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('CEO escalation fetch error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    return NextResponse.json({
      escalation: escalation || null,
      requires_ceo_approval: !!escalation && !escalation.decision,
    });
  } catch (error) {
    console.error('GET /api/trades/[id]/ceo-decision error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
