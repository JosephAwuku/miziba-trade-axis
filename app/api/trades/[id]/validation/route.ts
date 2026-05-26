export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { ValidationChecklist, User } from '@/lib/types';
import { notifyTradeParticipants, notifyCeoAction } from '@/lib/notifications';
import { checkStageTransitionGuards, validateStageTransition } from '@/lib/business-logic';

// GET /api/trades/[id]/validation — Get validation checklist
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
    const { data: validation, error } = await (admin
      .from('trade_validations') as any)
      .select('*')
      .eq('trade_id', tradeId)
      .single();

    if (error || !validation) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const val = validation as any;

    // Transform DB row to ValidationChecklist format
    const checklist: ValidationChecklist = {
      business: {
        completed: val.trader_qualified && val.margin_viable,
        items: [
          { id: 'trader_qualified', label: 'Trader KYC & Track Record', status: val.trader_qualified, notes: val.trader_notes || '' },
          { id: 'margin_viable', label: 'Margin & Risk Assessment', status: val.margin_viable, notes: val.margin_notes || '' },
        ],
      },
      product: {
        completed: val.price_reasonable,
        items: [
          { id: 'price_reasonable', label: 'Price Reasonableness', status: val.price_reasonable, notes: val.price_notes || '' },
        ],
      },
      shipping: {
        completed: val.sourcing_feasible,
        items: [
          { id: 'sourcing_feasible', label: 'Sourcing Capacity & Logistics', status: val.sourcing_feasible, notes: val.sourcing_notes || '' },
        ],
      },
      kyc: {
        completed: val.buyer_verified,
        items: [
          { id: 'buyer_verified', label: 'Buyer Verification', status: val.buyer_verified, notes: val.buyer_notes || '' },
        ],
      },
      risk: {
        completed: val.decision === 'validated',
        items: [
          { id: 'overall_validated', label: 'Overall Validation', status: val.decision === 'validated' },
        ],
      },
    };

    const totalItems = 5;
    const completedItems = [
      val.trader_qualified,
      val.margin_viable,
      val.price_reasonable,
      val.sourcing_feasible,
      val.buyer_verified
    ].filter(Boolean).length;
    
    const overall_progress = Math.round((completedItems / totalItems) * 100);

    return NextResponse.json({
      trade_id: tradeId,
      checklist,
      overall_progress,
    });
  } catch (error) {
    console.error('GET /api/trades/[id]/validation error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// PATCH /api/trades/[id]/validation — Update validation item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tradeId } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const typedUser = auth.profile as any;
    if (!['deal_officer', 'ceo'].includes(typedUser.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const admin = supabaseAdmin;

    const { data: tradeRow } = await admin.from('trades').select('stage, trade_ref').eq('id', tradeId).single();
    if (!tradeRow) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    if (!['SUBMITTED', 'UNDER_VALIDATION'].includes(tradeRow.stage as string)) {
      return NextResponse.json(
        {
          error: 'INVALID_STAGE',
          message: 'Validation checklist can only be edited while the trade is SUBMITTED or UNDER_VALIDATION.',
        },
        { status: 400 }
      );
    }

    const { item_id, completed, notes, decision, decline_reason } = await request.json();

    const update: any = {};
    if (item_id) {
      if (['buyer_verified', 'price_reasonable', 'sourcing_feasible', 'trader_qualified', 'margin_viable'].includes(item_id)) {
        if (completed !== undefined) update[item_id] = completed;
        if (notes !== undefined) {
          const notesKey = item_id.replace('_verified', '_notes').replace('_reasonable', '_notes').replace('_feasible', '_notes').replace('_qualified', '_notes').replace('_viable', '_notes');
          update[notesKey] = notes;
        }
      } else {
        return NextResponse.json({ error: 'INVALID_ITEM' }, { status: 400 });
      }
    }

    if (decision) {
      if (['validated', 'declined', 'referred'].includes(decision)) {
        update.decision = decision;
        if (decline_reason) update.decline_reason = decline_reason;
        if (decision === 'validated') {
          update.completed_at = new Date().toISOString();
          update.validated_by = typedUser.id;
        }
      } else {
        return NextResponse.json({ error: 'INVALID_DECISION' }, { status: 400 });
      }
    }

    if (!item_id && !decision) {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    const { data: updated, error } = await (admin
      .from('trade_validations') as any)
      .update({
        ...update,
        updated_at: new Date().toISOString(),
      })
      .eq('trade_id', tradeId)
      .select()
      .single();

    if (error) {
      console.error('Validation update error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    // Staff picking up validation: SUBMITTED → UNDER_VALIDATION
    let { data: trade } = await admin
      .from('trades')
      .select('stage, trade_ref, id, risk_score')
      .eq('id', tradeId)
      .single();

    if (trade?.stage === 'SUBMITTED') {
      await admin
        .from('trades')
        .update({ stage: 'UNDER_VALIDATION', updated_at: new Date().toISOString() })
        .eq('id', tradeId)
        .eq('stage', 'SUBMITTED');
      const { data: refreshed } = await admin
        .from('trades')
        .select('stage, trade_ref, id, risk_score')
        .eq('id', tradeId)
        .single();
      trade = refreshed;
    }

    const allComplete =
      updated.buyer_verified &&
      updated.price_reasonable &&
      updated.sourcing_feasible &&
      updated.trader_qualified &&
      updated.margin_viable;

    if (allComplete && trade && trade.stage === 'UNDER_VALIDATION') {
      const guards = await checkStageTransitionGuards(admin, tradeId, 'VALIDATED');
      const transition = validateStageTransition('UNDER_VALIDATION', 'VALIDATED', guards);
      if (!transition.allowed) {
        return NextResponse.json(
          { error: 'INVALID_TRANSITION', message: transition.reason, guards },
          { status: 400 }
        );
      }

      await admin
        .from('trades')
        .update({
          stage: 'VALIDATED',
          validated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tradeId);

      await notifyTradeParticipants(admin, trade, {
        subject: 'Trade Validation Complete',
        body: `Trade ${trade.trade_ref} has completed all validation checks and is now in VALIDATED stage. Next: Risk Scoring.`,
        type: 'VALIDATION_COMPLETE',
        excludeUserId: typedUser.id,
      });
    }

    // Notify on decision
    if (decision) {
      // 1. Get trade info for notification
      const { data: trade } = await admin.from('trades').select('*').eq('id', tradeId).single();
      
      if (trade) {
        if (decision === 'validated') {
          await notifyTradeParticipants(admin, trade, {
            subject: 'Trade Validated',
            body: `Trade ${trade.trade_ref} has been successfully validated and is moving to Finance Review.`,
            type: 'TRADE_VALIDATED',
            excludeUserId: typedUser.id
          });
          
          await notifyCeoAction(admin, {
            subject: 'Action Required: CEO Review',
            body: `Trade ${trade.trade_ref} is validated. Risk Score: ${trade.risk_score || 'N/A'}.`,
            type: 'CEO_REVIEW_REQUIRED',
            tradeId: trade.id
          });
        } else if (decision === 'declined') {
          await notifyTradeParticipants(admin, trade, {
            subject: 'Trade Declined',
            body: `Trade ${trade.trade_ref} was declined during validation. Reason: ${decline_reason || 'N/A'}`,
            type: 'TRADE_DECLINED',
            excludeUserId: typedUser.id
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      validation: updated,
      message: 'Validation updated successfully',
    });
  } catch (error) {
    console.error('PATCH /api/trades/[id]/validation error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}