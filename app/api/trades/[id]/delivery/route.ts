export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { User } from '@/lib/types';
import { notifyTradeParticipants } from '@/lib/notifications';

// PATCH /api/trades/[id]/delivery — Confirm goods delivered
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

    // Only Deal Officers and CEO can confirm delivery
    if (!['deal_officer', 'ceo'].includes(typedUser.role as string)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const admin = supabaseAdmin;

    // Get trade info
    const { data: trade, error: tradeError } = await admin
      .from('trades')
      .select('stage, trade_ref, volume_mt, delivered_weight_mt')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    // Verify trade is in PROCURING stage
    if (trade.stage !== 'PROCURING') {
      return NextResponse.json({ 
        error: 'INVALID_STAGE', 
        message: 'Delivery can only be confirmed when trade is in PROCURING stage.' 
      }, { status: 400 });
    }

    const body = await request.json();
    const { delivered_weight_mt, volume_procured_mt, grade_a_pct, grade_b_pct, grade_c_pct } = body;

    // Validate delivery data
    if (!delivered_weight_mt || delivered_weight_mt <= 0) {
      return NextResponse.json({ 
        error: 'INVALID_WEIGHT',
        message: 'Delivered weight must be greater than 0.'
      }, { status: 400 });
    }

    // Calculate variance
    const expectedWeight = trade.volume_mt;
    const variance = ((delivered_weight_mt - expectedWeight) / expectedWeight) * 100;

    // Update delivery information
    const updateData: any = {
      delivered_weight_mt,
      volume_procured_mt: volume_procured_mt || delivered_weight_mt,
      weight_variance_pct: parseFloat(variance.toFixed(2)),
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (grade_a_pct !== undefined) updateData.grade_a_pct = grade_a_pct;
    if (grade_b_pct !== undefined) updateData.grade_b_pct = grade_b_pct;
    if (grade_c_pct !== undefined) updateData.grade_c_pct = grade_c_pct;

    const { error: updateError } = await admin
      .from('trades')
      .update(updateData)
      .eq('id', tradeId);

    if (updateError) {
      console.error('Delivery confirmation update error:', updateError);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    // Notify trader and internal staff
    await notifyTradeParticipants(admin, trade, {
      subject: 'Goods Delivery Confirmed',
      body: `Trade ${trade.trade_ref}: Delivery of ${delivered_weight_mt} MT confirmed (${variance >= 0 ? '+' : ''}${variance.toFixed(2)}% variance). Trade can now advance to DELIVERED stage.`,
      type: 'DELIVERY_CONFIRMED',
      excludeUserId: typedUser.id,
    });

    return NextResponse.json({
      success: true,
      delivered_weight_mt,
      weight_variance_pct: variance,
      can_advance_to_delivered: true,
      message: 'Delivery confirmed. Trade can now advance to DELIVERED stage.',
    });
  } catch (error) {
    console.error('PATCH /api/trades/[id]/delivery error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// GET /api/trades/[id]/delivery — Get delivery status
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
      .select('delivered_weight_mt, volume_mt, weight_variance_pct, delivered_at, stage, grade_a_pct, grade_b_pct, grade_c_pct')
      .eq('id', tradeId)
      .single();

    if (error || !trade) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({
      delivered_weight_mt: trade.delivered_weight_mt || 0,
      expected_weight_mt: trade.volume_mt,
      weight_variance_pct: trade.weight_variance_pct || 0,
      delivered_at: trade.delivered_at,
      grade_a_pct: trade.grade_a_pct,
      grade_b_pct: trade.grade_b_pct,
      grade_c_pct: trade.grade_c_pct,
      can_advance_to_delivered: (trade.delivered_weight_mt || 0) > 0,
    });
  } catch (error) {
    console.error('GET /api/trades/[id]/delivery error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
