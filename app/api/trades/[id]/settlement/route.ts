export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { User, WaterfallInstruction } from '@/lib/types';
import { calculateWaterfall } from '@/lib/business-logic';
import { auditLog } from '@/lib/rbac';

// GET /api/trades/[id]/settlement — Get waterfall/settlement status
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
    if (!hasPermission(typedUser, 'settlement.view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = await supabaseAdmin();
    const { data: trade, error: tradeError } = await admin
      .from('trades')
      .select(`
        *,
        waterfall_instructions(*),
        finance_data_packages(*)
      `)
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    if (!checkOwnership(typedUser.role, 'trades', typedUser, trade as any)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const waterfall = (trade as any).waterfall_instructions;
    const fdp = (trade as any).finance_data_packages?.[0];

    if (!waterfall) {
      return NextResponse.json({
        trade_id: tradeId,
        status: 'not_started',
        message: 'Waterfall instructions not yet generated'
      });
    }

    // Map DB columns to progress object for UI
    const progress = {
      percentage: waterfall.status === 'COMPLETED' ? 100 : (waterfall.cfo_1_confirmed || waterfall.cfo_2_confirmed ? 50 : 0),
      status: waterfall.status,
      amount_paid: waterfall.buyer_payment_usd || 0,
      total_amount: trade.contract_value_usd,
      remaining: Math.max(0, trade.contract_value_usd - (waterfall.buyer_payment_usd || 0))
    };

    return NextResponse.json({
      trade_id: tradeId,
      settlement: waterfall,
      progress,
      signatures: [
        waterfall.cfo_1_id && { user_id: waterfall.cfo_1_id, confirmed: waterfall.cfo_1_confirmed, signed_at: waterfall.cfo_1_confirmed_at },
        waterfall.cfo_2_id && { user_id: waterfall.cfo_2_id, confirmed: waterfall.cfo_2_confirmed, signed_at: waterfall.cfo_2_confirmed_at }
      ].filter((s: any) => s.user_id),
      waterfall_instructions: [
        { label: 'Finance Partner Share', amount: waterfall.fp_principal_usd + waterfall.fp_fee_usd, priority: 1, entity: 'FP' },
        { label: 'Miziba Facilitation Fee', amount: waterfall.miziba_fee_usd, priority: 2, entity: 'Miziba' },
        { label: 'Trader Residual Margin', amount: waterfall.trader_margin_usd, priority: 3, entity: 'Trader' }
      ]
    });

  } catch (error) {
    console.error('Waterfall GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/trades/[id]/settlement — Update waterfall confirmation
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
    const body = await request.json();
    const { action } = body;

    const admin = await supabaseAdmin();

    // Fetch trade for context
    const { data: trade } = await admin
      .from('trades')
      .select('*, waterfall_instructions(*)')
      .eq('id', tradeId)
      .single();

    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const tradeData = trade as any;

    if (action === 'initiate') {
      if (!['cfo', 'ceo', 'deal_officer'].includes(typedUser.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Create initial waterfall instruction
      const { data: newWf, error: wfError } = await (admin
        .from('waterfall_instructions') as any)
        .insert({
          trade_id: tradeId,
          status: 'PENDING',
          fp_principal_usd: tradeData.finance_facility_usd,
          // Estimated fees until payment recorded
          fp_fee_usd: tradeData.finance_facility_usd * 0.12 * (60 / 365), 
          miziba_fee_usd: tradeData.contract_value_usd * 0.005
        })
        .select()
        .single();

      if (wfError) throw wfError;

      await auditLog(admin, {
        userId: typedUser.id,
        tradeId: tradeId,
        action: 'SETTLEMENT_INITIATED',
        entityType: 'WATERFALL',
        entityId: newWf.id,
        newValue: newWf
      });

      return NextResponse.json({ success: true, waterfall: newWf });
    }

    if (action === 'record_payment') {
      if (!['cfo', 'ceo'].includes(typedUser.role)) {
        return NextResponse.json({ error: 'Only CFOs and CEOs can record payments' }, { status: 403 });
      }

      const { payment_amount, payment_date } = body;
      
      // Calculate pro-rata tenor (date difference from funding)
      const fundedAt = new Date(tradeData.funded_at || tradeData.applied_at);
      const paidAt = new Date(payment_date);
      const tenorDays = Math.max(1, Math.ceil((paidAt.getTime() - fundedAt.getTime()) / (1000 * 3600 * 24)));

      const result = calculateWaterfall({
        buyerPaymentUsd: payment_amount,
        financeFacilityUsd: tradeData.finance_facility_usd,
        fpFeeRatePa: 0.12, // Standard PA
        tenorDays,
        contractValueUsd: tradeData.contract_value_usd
      });

      const { data: updatedWf, error: wfUpdateError } = await (admin
        .from('waterfall_instructions') as any)
        .update({
          buyer_payment_usd: payment_amount,
          buyer_payment_date: payment_date,
          fp_principal_usd: result.fpPrincipalUsd,
          fp_fee_usd: result.fpFeeUsd,
          miziba_fee_usd: result.mizabaFeeUsd,
          trader_margin_usd: result.traderMarginUsd,
          tenor_days: tenorDays,
          status: 'IN_PROGRESS',
          updated_at: new Date().toISOString()
        })
        .eq('trade_id', tradeId)
        .select()
        .single();

      if (wfUpdateError) throw wfUpdateError;

      await auditLog(admin, {
        userId: typedUser.id,
        tradeId: tradeId,
        action: 'PAYMENT_RECORDED',
        entityType: 'WATERFALL',
        entityId: updatedWf.id,
        newValue: updatedWf
      });

      return NextResponse.json({ success: true, waterfall: updatedWf });
    }

    if (action === 'sign') {
      if (!['cfo', 'ceo'].includes(typedUser.role)) {
        return NextResponse.json({ error: 'Only CFOs and CEOs can sign waterfalls' }, { status: 403 });
      }

      const waterfall = tradeData.waterfall_instructions;
      if (!waterfall) {
        return NextResponse.json({ error: 'Waterfall not initiated' }, { status: 400 });
      }

      let updateData: any = {};
      if (!waterfall.cfo_1_confirmed) {
        updateData = {
          cfo_1_id: typedUser.id,
          cfo_1_confirmed: true,
          cfo_1_confirmed_at: new Date().toISOString()
        };
      } else if (!waterfall.cfo_2_confirmed && waterfall.cfo_1_id !== typedUser.id) {
        updateData = {
          cfo_2_id: typedUser.id,
          cfo_2_confirmed: true,
          cfo_2_confirmed_at: new Date().toISOString(),
          status: 'COMPLETED',
          instructed_at: new Date().toISOString()
        };
      } else {
        return NextResponse.json({ error: 'Already signed or second signature required from different user' }, { status: 400 });
      }

      await (admin
        .from('waterfall_instructions') as any)
        .update(updateData)
        .eq('id', waterfall.id);

      // Transition trade stage if fully finalized
      if (updateData.status === 'COMPLETED') {
        await (admin
          .from('trades') as any)
          .update({ stage: 'SETTLED', settled_at: new Date().toISOString() })
          .eq('id', tradeId);
          
        await auditLog(admin, {
          userId: typedUser.id,
          tradeId: tradeId,
          action: 'SETTLEMENT_FINALIZED',
          entityType: 'TRADE',
          entityId: tradeId
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });

  } catch (error) {
    console.error('Waterfall POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}