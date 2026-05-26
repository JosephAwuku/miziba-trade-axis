export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { User, Trade } from '@/lib/types';
import { validateStageTransition } from '@/lib/business-logic';
import { auditLog } from '@/lib/rbac';
import { notifyTradeParticipants } from '@/lib/notifications';

// GET /api/trades/[id] — Get trade details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    // getAuthenticatedUser now handles both token and cookies
    const auth = await getAuthenticatedUser(token);

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const typedUser: User = auth.profile as User;

    const admin = supabaseAdmin;
    const { data: trade, error } = await admin
      .from('trades')
      .select(`
        *,
        organisations!trades_trader_org_id_fkey (
          name,
          kyc_status
        ),
        finance_partner:organisations!trades_fp_org_id_fkey (
          name
        ),
        buyers (
          name,
          country
        ),
        deal_officer:users!trades_deal_officer_id_fkey (
          full_name
        )
      `)
      .eq('id', id)
      .single();

    if (error || !trade) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const tradeData = trade as any;

    // Role-based access control
    if (typedUser.role === 'trader' && tradeData.trader_org_id !== typedUser.org_id) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    if (typedUser.role === 'finance_partner' && tradeData.fp_org_id !== typedUser.org_id && tradeData.stage !== 'FINANCE_REVIEW') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    return NextResponse.json({
      trade: {
        ...tradeData,
        trader_org_kyc_status: tradeData.organisations?.kyc_status || 'PENDING',
      },
    });
  } catch (error) {
    console.error('GET /api/trades/[id] error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// PATCH /api/trades/[id] — Update trade
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const typedUser: User = auth.profile as User;

    const admin = supabaseAdmin;

    // Get current trade to check permissions and stage transition
    const { data: currentTrade } = await admin
      .from('trades')
      .select('trader_org_id, fp_org_id, stage, risk_score, kyc_status, contract_value_usd')
      .eq('id', id)
      .single();

    if (!currentTrade) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const tradeData = currentTrade as any;
    const body = await request.json();

    // Basic permission check
    const isOwner = typedUser.role === 'trader' && tradeData.trader_org_id === typedUser.org_id;
    const isInternal = ['deal_officer', 'ceo', 'cfo', 'ops_admin'].includes(typedUser.role as string);
    const isFP = typedUser.role === 'finance_partner' && tradeData.fp_org_id === typedUser.org_id;

    if (!isOwner && !isInternal && !isFP) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    if (typedUser.role === 'ops_admin') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Operations Admin has read-only access to trades.' },
        { status: 403 }
      );
    }

    // Only Deal Officer, CEO, or assigned Finance Partner may change stage (per WORKFLOWS RBAC)
    if (body.stage !== undefined && body.stage !== tradeData.stage) {
      const fpStageOk =
        typedUser.role === 'finance_partner' &&
        tradeData.stage === 'FINANCE_REVIEW' &&
        (body.stage === 'FUNDED' || body.stage === 'CLOSED');
      const internalStageOk =
        typedUser.role === 'deal_officer' || typedUser.role === 'ceo';
      if (!internalStageOk && !fpStageOk) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Your role cannot change trade stage.' },
          { status: 403 }
        );
      }
    }

    // Stage transition validation - NO BYPASSES
    if (body.stage && body.stage !== tradeData.stage) {
      // Import the guard checker
      const { checkStageTransitionGuards } = await import('@/lib/business-logic');
      
      // Get actual guards from database
      const guards = await checkStageTransitionGuards(admin, id, body.stage);
      
      // Validate transition with real data
      const result = validateStageTransition(tradeData.stage, body.stage, guards);

      if (!result.allowed) {
        return NextResponse.json({ 
          error: 'INVALID_TRANSITION', 
          message: result.reason,
          stage: body.stage,
          guards 
        }, { status: 400 });
      }
    }

    // Filter allowed updates by role
    const allowedUpdates: any = {};
    if (isInternal) {
      if (body.stage) allowedUpdates.stage = body.stage;
      if (body.fp_org_id) allowedUpdates.fp_org_id = body.fp_org_id;
      if (body.deal_officer_id) allowedUpdates.deal_officer_id = body.deal_officer_id;
      if (body.risk_score !== undefined) allowedUpdates.risk_score = body.risk_score;
      if (body.capital_deployed_pct !== undefined) allowedUpdates.capital_deployed_pct = body.capital_deployed_pct;
      
      // Extended fields for internal reconciliation
      if (body.commodity) allowedUpdates.commodity = body.commodity;
      if (body.grade) allowedUpdates.grade = body.grade;
      if (body.volume_mt !== undefined) allowedUpdates.volume_mt = body.volume_mt;
      if (body.price_per_mt_usd !== undefined) allowedUpdates.price_per_mt_usd = body.price_per_mt_usd;
      if (body.procurement_cost_usd !== undefined) allowedUpdates.procurement_cost_usd = body.procurement_cost_usd;
      if (body.trader_equity_usd !== undefined) allowedUpdates.trader_equity_usd = body.trader_equity_usd;
      if (body.finance_facility_usd !== undefined) allowedUpdates.finance_facility_usd = body.finance_facility_usd;
      if (body.delivery_point) allowedUpdates.delivery_point = body.delivery_point;
      if (body.deadline_date) allowedUpdates.deadline_date = body.deadline_date;
      if (body.payment_terms_days !== undefined) allowedUpdates.payment_terms_days = body.payment_terms_days;
      if (body.escrow_id) allowedUpdates.escrow_id = body.escrow_id;
      if (body.shipment_id) allowedUpdates.shipment_id = body.shipment_id;
    }

    if (isOwner && tradeData.stage === 'SUBMITTED') {
      if (body.delivery_point) allowedUpdates.delivery_point = body.delivery_point;
    }

    if (isFP && tradeData.stage === 'FINANCE_REVIEW') {
      if (body.stage === 'FUNDED' || body.stage === 'CLOSED') {
        allowedUpdates.stage = body.stage;
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: 'NO_CHANGES_ALLOWED' }, { status: 400 });
    }

    const { data: updatedTrade, error: updateError } = await (admin
      .from('trades') as any)
      .update({
        ...allowedUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Trade update error:', updateError);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    // Audit logging for manual actions
    if (body.stage || body.risk_score !== undefined) {
      await auditLog(admin, {
        userId: typedUser.id,
        tradeId: id,
        action: body.stage ? `STAGE_CHANGE_${body.stage}` : 'RISK_UPDATE',
        entityType: 'TRADE',
        entityId: id,
        oldValue: { stage: tradeData.stage, risk: tradeData.risk_score },
        newValue: { stage: updatedTrade.stage, risk: updatedTrade.risk_score }
      });

      // Notify relevant parties with human-readable stage labels
      try {
        const STAGE_LABELS: Record<string, string> = {
          SUBMITTED:      'Submitted — awaiting validation',
          UNDER_REVIEW:   'Under Review by our deal team',
          VALIDATED:      'Validated — risk assessment in progress',
          FINANCE_REVIEW: 'Finance Review — being assessed by the finance partner',
          FUNDED:         'Funded — deal financing approved',
          ACTIVE:         'Active — trade is in progress',
          DELIVERY:       'In Delivery — goods in transit',
          SETTLEMENT:     'Settlement — payment processing',
          CLOSED:         'Closed — trade completed successfully',
          REJECTED:       'Rejected — trade was not approved',
        };

        const stageLabel = (s: string) => STAGE_LABELS[s] || s;

        await notifyTradeParticipants(admin, updatedTrade, {
          subject: body.stage
            ? `Trade ${updatedTrade.trade_ref}: ${stageLabel(body.stage)}`
            : `Trade ${updatedTrade.trade_ref}: Risk score updated`,
          body: body.stage
            ? `Your trade application ${updatedTrade.trade_ref} has progressed to: ${stageLabel(body.stage)}.`
            : `The risk assessment for trade ${updatedTrade.trade_ref} has been updated to ${body.risk_score}/100.`,
          type: body.stage ? 'STAGE_UPDATE' : 'RISK_UPDATE',
          excludeUserId: typedUser.id,
        });
      } catch (notifErr) {
        console.error('Non-blocking notification error:', notifErr);
      }
    }

    return NextResponse.json({ trade: updatedTrade });
  } catch (error) {
    console.error('PATCH /api/trades/[id] error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
