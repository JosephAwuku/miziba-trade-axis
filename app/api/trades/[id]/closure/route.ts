export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { User } from '@/lib/types';
import { validateClosure } from '@/lib/business-logic';
import { notifyTradeParticipants } from '@/lib/notifications';

// GET /api/trades/[id]/closure — Get closure checklist
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

    // Get closure checklist
    const { data: closure, error } = await admin
      .from('trade_closure_checklists')
      .select('*')
      .eq('trade_id', tradeId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Closure checklist fetch error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    // If no checklist exists, return empty one
    if (!closure) {
      return NextResponse.json({
        trade_id: tradeId,
        checklist: {
          waterfall_confirmed: false,
          trr_received: false,
          ccc_received: false,
          buyer_perf_recorded: false,
          trader_rec_updated: false,
          fp_report_sent: false,
          record_locked: false,
        },
        can_close: false,
        completed_items: 0,
        total_items: 7,
      });
    }

    const checklistData = {
      waterfall_confirmed: closure.waterfall_confirmed || false,
      trr_received: closure.trr_received || false,
      ccc_received: closure.ccc_received || false,
      buyer_perf_recorded: closure.buyer_perf_recorded || false,
      trader_rec_updated: closure.trader_rec_updated || false,
      fp_report_sent: closure.fp_report_sent || false,
      record_locked: closure.record_locked || false,
    };

    const validation = validateClosure(checklistData);

    return NextResponse.json({
      trade_id: tradeId,
      checklist: checklistData,
      can_close: validation.canLock,
      completed_items: validation.completedCount,
      total_items: validation.totalItems,
      locked_at: closure.locked_at,
    });
  } catch (error) {
    console.error('GET /api/trades/[id]/closure error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// PATCH /api/trades/[id]/closure — Update closure checklist item
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

    // Only Deal Officers and CEO can update closure checklist
    if (!['deal_officer', 'ceo'].includes(typedUser.role as string)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const admin = supabaseAdmin;

    // Get trade info
    const { data: trade, error: tradeError } = await admin
      .from('trades')
      .select('stage, trade_ref')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    // Verify trade is in SETTLED stage
    if (trade.stage !== 'SETTLED') {
      return NextResponse.json({ 
        error: 'INVALID_STAGE', 
        message: 'Closure checklist can only be updated when trade is in SETTLED stage.' 
      }, { status: 400 });
    }

    const body = await request.json();
    const updates: any = {};

    // Update allowed fields
    const allowedFields = [
      'waterfall_confirmed',
      'trr_received',
      'ccc_received',
      'buyer_perf_recorded',
      'trader_rec_updated',
      'fp_report_sent',
      'record_locked',
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'NO_UPDATES' }, { status: 400 });
    }

    // Upsert the closure checklist
    const { data: closure, error: updateError } = await admin
      .from('trade_closure_checklists')
      .upsert({
        trade_id: tradeId,
        ...updates,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'trade_id',
      })
      .select()
      .single();

    if (updateError) {
      console.error('Closure checklist update error:', updateError);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    // Check if all items are complete
    const checklistData = {
      waterfall_confirmed: closure.waterfall_confirmed || false,
      trr_received: closure.trr_received || false,
      ccc_received: closure.ccc_received || false,
      buyer_perf_recorded: closure.buyer_perf_recorded || false,
      trader_rec_updated: closure.trader_rec_updated || false,
      fp_report_sent: closure.fp_report_sent || false,
      record_locked: closure.record_locked || false,
    };

    const validation = validateClosure(checklistData);

    // If record_locked is checked and all items complete, advance to CLOSED
    if (closure.record_locked && validation.canLock) {
      await admin
        .from('trades')
        .update({
          stage: 'CLOSED',
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tradeId);

      // Update locked_at timestamp
      await admin
        .from('trade_closure_checklists')
        .update({
          locked_at: new Date().toISOString(),
        })
        .eq('trade_id', tradeId);

      // Notify participants about closure
      await notifyTradeParticipants(admin, trade, {
        subject: 'Trade Closed',
        body: `Trade ${trade.trade_ref} has been closed and locked. All records are now immutable.`,
        type: 'TRADE_CLOSED',
        excludeUserId: typedUser.id,
      });

      return NextResponse.json({
        success: true,
        closure,
        can_close: true,
        message: 'Trade has been closed and locked.',
      });
    }

    return NextResponse.json({
      success: true,
      closure,
      can_close: validation.canLock,
      completed_items: validation.completedCount,
      total_items: validation.totalItems,
      message: validation.canLock 
        ? 'All closure items complete. You can now lock the record.' 
        : `${validation.completedCount}/${validation.totalItems} closure items complete.`,
    });
  } catch (error) {
    console.error('PATCH /api/trades/[id]/closure error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
