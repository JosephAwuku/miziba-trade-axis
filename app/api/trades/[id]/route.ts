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

    const admin = await supabaseAdmin();
    const { data: trade, error } = await admin
      .from('trades')
      .select(`
        *,
        organisations!trades_trader_org_id_fkey (
          name
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

    return NextResponse.json({ trade: tradeData });
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

    const admin = await supabaseAdmin();

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

    // Stage transition validation
    if (body.stage && body.stage !== tradeData.stage) {
      // Internal roles can manually advance stages in Standalone Mode
      // We still validate sequence unless it's an ops_admin override
      if (typedUser.role !== 'ops_admin') {
        const result = validateStageTransition(tradeData.stage, body.stage, {
          validationComplete: true, // In standalone, we assume human verification
          fpApproved: true,
          escrowFunded: true,
          buyerPaid: true
        });

        if (!result.allowed) {
          return NextResponse.json({ error: 'INVALID_TRANSITION', message: result.reason }, { status: 400 });
        }
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

      // Notify relevant parties
      try {
        await notifyTradeParticipants(admin, updatedTrade, {
          subject: body.stage ? `Trade Stage Updated: ${body.stage}` : 'Risk Score Updated',
          body: body.stage 
            ? `Trade ${updatedTrade.tr} has moved from ${tradeData.stage} to ${body.stage}.`
            : `The risk assessment for Trade ${updatedTrade.tr} has been recalculated to ${body.risk_score}/100.`,
          type: body.stage ? 'STAGE_UPDATE' : 'RISK_UPDATE',
          excludeUserId: typedUser.id
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
