export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { hasPermission, checkOwnership } from '@/lib/rbac';
import { calculateWaterfall } from '@/lib/business-logic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tradeId } = await params;
    const auth = await getAuthenticatedUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const typedUser = auth.profile as any;
    if (!hasPermission(typedUser, 'fdp.view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = await supabaseAdmin();
    const { data: trade, error: tradeError } = await admin
      .from('trades')
      .select(`
        *,
        finance_data_packages(*)
      `)
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const tradeData = trade as any;
    if (!checkOwnership(typedUser.role, 'trades', typedUser, tradeData)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let fdp = tradeData.finance_data_packages?.find((p: any) => p.is_current);

    if (!fdp) {
      // Return a preview even if not yet saved to DB
      const waterfallResult = calculateWaterfall({
        buyerPaymentUsd: tradeData.contract_value_usd,
        financeFacilityUsd: tradeData.finance_facility_usd,
        fpFeeRatePa: tradeData.fp_fee_rate_pa ?? 0.08,
        tenorDays: tradeData.tenor_days ?? 90,
        contractValueUsd: tradeData.contract_value_usd,
      });

      fdp = {
        trade_id: tradeId,
        generated_at: new Date().toISOString(),
        is_preview: true,
        waterfall_preview: waterfallResult.instructions
      };
    }

    return NextResponse.json({
      trade_id: tradeId,
      fdp
    });

  } catch (error) {
    console.error('FDP GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tradeId } = await params;
    const auth = await getAuthenticatedUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const typedUser = auth.profile as any;
    if (!hasPermission(typedUser, 'fdp.generate')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body; // e.g., 'generate', 'send_to_fp'

    const admin = await supabaseAdmin();
    const { data: trade, error: tradeError } = await admin
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const tradeData = trade as any;

    if (action === 'generate') {
      // Mark old FDPs as not current
      await (admin
        .from('finance_data_packages') as any)
        .update({ is_current: false })
        .eq('trade_id', tradeId);

      const { data: fdp, error: fdpError } = await (admin
        .from('finance_data_packages') as any)
        .insert({
          trade_id: tradeId,
          generated_by: typedUser.id,
          generated_at: new Date().toISOString(),
          is_current: true
        })
        .select()
        .single();

      if (fdpError) throw fdpError;

      // Update trade stage
      await (admin
        .from('trades') as any)
        .update({ stage: 'FINANCE_REVIEW', updated_at: new Date().toISOString() })
        .eq('id', tradeId);

      return NextResponse.json({ success: true, fdp });

    } else if (action === 'send_to_fp') {
      const { data: fdp } = await admin
        .from('finance_data_packages')
        .select('*')
        .eq('trade_id', tradeId)
        .eq('is_current', true)
        .single();

      if (!fdp) return NextResponse.json({ error: 'No current FDP found' }, { status: 404 });

      const currentFdp = fdp as any;

      await (admin
        .from('finance_data_packages') as any)
        .update({ 
          sent_to_fp_at: new Date().toISOString(),
          sent_by: typedUser.id
        })
        .eq('id', currentFdp.id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('FDP POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}