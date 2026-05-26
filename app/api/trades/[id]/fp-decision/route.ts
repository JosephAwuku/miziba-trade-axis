export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { User } from '@/lib/types';
import { notifyTradeParticipants } from '@/lib/notifications';
import { checkStageTransitionGuards, validateStageTransition } from '@/lib/business-logic';

// POST /api/trades/[id]/fp-decision — Finance Partner makes decision
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

    // Only Finance Partners can make decisions
    if (typedUser.role !== 'finance_partner') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const admin = supabaseAdmin;

    const { data: fpProfile, error: fpProfileError } = await admin
      .from('finance_partner_profiles')
      .select('onboarding_done, onboarding_step')
      .eq('org_id', typedUser.org_id)
      .single();

    if (fpProfileError || !fpProfile?.onboarding_done) {
      return NextResponse.json(
        {
          error: 'ONBOARDING_REQUIRED',
          message:
            'Complete partner onboarding before approving or declining facility requests.',
          onboarding_step: fpProfile?.onboarding_step ?? 1,
        },
        { status: 403 }
      );
    }

    // Get trade to verify FP assignment
    const { data: trade, error: tradeError } = await admin
      .from('trades')
      .select('fp_org_id, stage, trade_ref, trader_org_id')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    // Verify this FP is assigned to the trade
    if (trade.fp_org_id !== typedUser.org_id) {
      return NextResponse.json({ error: 'NOT_ASSIGNED' }, { status: 403 });
    }

    // Verify trade is in FINANCE_REVIEW stage
    if (trade.stage !== 'FINANCE_REVIEW') {
      return NextResponse.json({ 
        error: 'INVALID_STAGE', 
        message: 'Trade must be in FINANCE_REVIEW stage for FP decision.' 
      }, { status: 400 });
    }

    const body = await request.json();
    const { decision, notes, info_request } = body;

    // Validate decision
    if (!['approve', 'decline', 'info_request'].includes(decision)) {
      return NextResponse.json({ error: 'INVALID_DECISION' }, { status: 400 });
    }

    // Create FP decision record
    const { data: fpDecision, error: decisionError } = await admin
      .from('fp_decisions')
      .insert({
        trade_id: tradeId,
        fp_org_id: typedUser.org_id,
        decision,
        decided_by: typedUser.id,
        decided_at: new Date().toISOString(),
        notes: notes || null,
        info_request: info_request || null,
      })
      .select()
      .single();

    if (decisionError) {
      console.error('FP decision insert error:', decisionError);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    // If approved, advance trade to FUNDED stage (same guards as PATCH /trades/[id])
    if (decision === 'approve') {
      const guards = await checkStageTransitionGuards(admin, tradeId, 'FUNDED');
      const transition = validateStageTransition(trade.stage, 'FUNDED', guards);
      if (!transition.allowed) {
        return NextResponse.json(
          { error: 'INVALID_TRANSITION', message: transition.reason, guards },
          { status: 400 }
        );
      }

      const { error: updateError } = await admin
        .from('trades')
        .update({
          stage: 'FUNDED',
          funded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tradeId);

      if (updateError) {
        console.error('Trade stage update error:', updateError);
        return NextResponse.json({ error: 'STAGE_UPDATE_ERROR' }, { status: 500 });
      }

      // Notify trader and deal officers
      await notifyTradeParticipants(admin, trade, {
        subject: 'Trade Approved - Funding Confirmed',
        body: `Trade ${trade.trade_ref} has been approved by the Finance Partner and is now in FUNDED stage.`,
        type: 'FP_APPROVED',
        excludeUserId: typedUser.id,
      });
    } else if (decision === 'decline') {
      // Notify trader and deal officers about decline
      await notifyTradeParticipants(admin, trade, {
        subject: 'Trade Declined by Finance Partner',
        body: `Trade ${trade.trade_ref} was declined by the Finance Partner. Reason: ${notes || 'Not specified'}`,
        type: 'FP_DECLINED',
        excludeUserId: typedUser.id,
      });
    } else if (decision === 'info_request') {
      // Notify deal officers about information request
      await notifyTradeParticipants(admin, trade, {
        subject: 'Finance Partner Requesting More Information',
        body: `Trade ${trade.trade_ref}: ${info_request || notes || 'Additional information required'}`,
        type: 'FP_INFO_REQUEST',
        excludeUserId: typedUser.id,
        audience: 'trader_and_officer',
      });
    }

    return NextResponse.json({
      success: true,
      decision: fpDecision,
      message: decision === 'approve' 
        ? 'Trade approved and moved to FUNDED stage.' 
        : decision === 'decline'
        ? 'Trade declined. Notification sent to trader and deal officers.'
        : 'Information request sent.',
    });
  } catch (error) {
    console.error('POST /api/trades/[id]/fp-decision error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// GET /api/trades/[id]/fp-decision — Get FP decisions for a trade
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

    // Get all FP decisions for this trade
    const { data: decisions, error } = await admin
      .from('fp_decisions')
      .select(`
        *,
        decided_by_user:users!fp_decisions_decided_by_fkey (
          full_name,
          email
        ),
        fp_org:organisations!fp_decisions_fp_org_id_fkey (
          name
        )
      `)
      .eq('trade_id', tradeId)
      .order('decided_at', { ascending: false });

    if (error) {
      console.error('FP decisions fetch error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    return NextResponse.json({
      decisions: decisions || [],
    });
  } catch (error) {
    console.error('GET /api/trades/[id]/fp-decision error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
