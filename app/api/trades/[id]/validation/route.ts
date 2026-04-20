export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { ValidationChecklist, User } from '@/lib/types';
import { notifyTradeParticipants, notifyInternalRoles } from '@/lib/notifications';

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
          { id: 'trader_qualified', label: 'Trader KYC & Track Record', status: val.trader_qualified },
          { id: 'margin_viable', label: 'Margin & Risk Assessment', status: val.margin_viable },
        ],
      },
      product: {
        completed: val.price_reasonable,
        items: [
          { id: 'price_reasonable', label: 'Price Reasonableness', status: val.price_reasonable },
        ],
      },
      shipping: {
        completed: val.sourcing_feasible,
        items: [
          { id: 'sourcing_feasible', label: 'Sourcing Capacity & Logistics', status: val.sourcing_feasible },
        ],
      },
      kyc: {
        completed: val.buyer_verified,
        items: [
          { id: 'buyer_verified', label: 'Buyer Verification', status: val.buyer_verified },
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
    if (!['deal_officer', 'ceo', 'ops_admin'].includes(typedUser.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { item_id, completed, decision, decline_reason } = await request.json();

    const update: any = {};
    if (item_id) {
      if (['buyer_verified', 'price_reasonable', 'sourcing_feasible', 'trader_qualified', 'margin_viable'].includes(item_id)) {
        update[item_id] = completed;
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

    const admin = supabaseAdmin;
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
          
          await notifyInternalRoles(admin, ['ceo'], {
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