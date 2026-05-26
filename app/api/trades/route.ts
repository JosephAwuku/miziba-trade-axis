export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getUserFromSession, getAuthenticatedUser } from '@/lib/supabase';
import { hasPermission } from '@/lib/rbac';
import { TradeSummary, TradeApplicationInput, User } from '@/lib/types';
import { notifyNewTradeSubmission } from '@/lib/notifications';
import { assertTraderCanSubmitTrades } from '@/lib/trader-kyc';
import { getDocumentsBucket } from '@/lib/supabase/buckets';
import {
  hasAllRequiredTradeDocs,
  missingRequiredTradeDocLabels,
  type TradeDocumentRecord,
} from '@/lib/trade-documents';

async function migrateDraftDocumentsToTrade(
  admin: typeof supabaseAdmin,
  {
    draftId,
    tradeId,
    orgId,
    uploadedBy,
  }: { draftId: string; tradeId: string; orgId: string; uploadedBy: string }
) {
  const { data: draft } = await admin
    .from('draft_trades')
    .select('draft_data')
    .eq('id', draftId)
    .eq('trader_org_id', orgId)
    .single();

  const draftData = (draft?.draft_data || {}) as Record<string, unknown>;
  const documents = (draftData.trade_documents as TradeDocumentRecord[]) || [];
  const bucket = getDocumentsBucket();

  for (const doc of documents) {
    if (!doc.storage_path) continue;

    const safeName = doc.storage_path.split('/').pop() || doc.name.replace(/\s+/g, '_');
    const tradePath = `trades/${tradeId}/${doc.doc_type}_${Date.now()}_${safeName}`;

    const { data: fileBlob, error: downloadError } = await admin.storage.from(bucket).download(doc.storage_path);
    if (downloadError || !fileBlob) {
      console.error('Draft document copy failed:', downloadError);
      continue;
    }

    const { error: uploadError } = await admin.storage.from(bucket).upload(tradePath, fileBlob, { upsert: true });
    if (uploadError) {
      console.error('Trade document upload failed:', uploadError);
      continue;
    }

    await (admin.from('trade_documents') as any).insert({
      trade_id: tradeId,
      name: doc.name,
      doc_type: doc.doc_type,
      s3_key: tradePath,
      size_bytes: doc.size_bytes || 0,
      uploaded_by: uploadedBy,
      status: 'UPLOADED',
    });
  }
}

// GET /api/trades — List trades (filtered by role)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    // getAuthenticatedUser now handles both token and cookies
    const auth = await getAuthenticatedUser(token);

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const typedUser: User = auth.profile as User;

    // Check permission
    const allowed = ['trade.list', 'trade.list.own', 'trade.list.assigned'].some(key =>
      hasPermission(typedUser, key)
    );

    if (!allowed) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage')?.split(',');
    const commodity = searchParams.get('commodity');
    const fp_org_id = searchParams.get('fp_org_id');
    const trader_org_id = searchParams.get('trader_org_id');
    const from_date = searchParams.get('from_date');
    const to_date = searchParams.get('to_date');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const per_page = Math.min(100, parseInt(searchParams.get('per_page') || '25'));
    const offset = (page - 1) * per_page;

    const admin = supabaseAdmin;
    let query = admin
      .from('trades')
      .select(`
        id,
        trade_ref,
        commodity,
        grade,
        volume_mt,
        price_per_mt_usd,
        contract_value_usd,
        finance_facility_usd,
        stage,
        kyc_status,
        risk_score,
        capital_deployed_pct,
        deadline_date,
        applied_at,
        trader_org_id,
        fp_org_id,
        organisations!trades_trader_org_id_fkey (
          name,
          kyc_status
        ),
        buyers (
          name
        )
      `, { count: 'exact' })
      .order('applied_at', { ascending: false })
      .range(offset, offset + per_page - 1);

    // Role-based filtering
    if (typedUser.role === 'trader') {
      query = query.eq('trader_org_id', typedUser.org_id);
    } else if (typedUser.role === 'finance_partner') {
      query = query.or(`fp_org_id.eq.${typedUser.org_id},stage.eq.FINANCE_REVIEW`);
    } else if (['deal_officer', 'ceo', 'cfo', 'ops_admin'].includes(typedUser.role as string)) {
      // Staff only see submitted trades from KYC-verified trader organisations
      query = query.eq('organisations.kyc_status', 'VERIFIED');
    }

    if (stage) {
      query = query.in('stage', stage);
    }
    if (commodity) {
      query = query.eq('commodity', commodity);
    }
    if (fp_org_id) {
      query = query.eq('fp_org_id', fp_org_id);
    }
    if (trader_org_id) {
      query = query.eq('trader_org_id', trader_org_id);
    }
    if (from_date) {
      query = query.gte('applied_at', from_date);
    }
    if (to_date) {
      query = query.lte('applied_at', to_date);
    }
    if (search) {
      query = query.ilike('trade_ref', `%${search}%`);
    }

    const { data: trades, error, count } = await query;

    if (error) {
      console.error('Trades query error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    const formattedTrades: TradeSummary[] = (trades || []).map((trade: any) => ({
      id: trade.id,
      trade_ref: trade.trade_ref,
      commodity: trade.commodity,
      grade: trade.grade,
      volume_mt: trade.volume_mt,
      price_per_mt_usd: trade.price_per_mt_usd,
      contract_value_usd: trade.contract_value_usd,
      finance_facility_usd: trade.finance_facility_usd,
      stage: trade.stage,
      kyc_status: trade.kyc_status,
      trader_org_kyc_status: trade.organisations?.kyc_status || 'PENDING',
      risk_score: trade.risk_score,
      capital_deployed_pct: trade.capital_deployed_pct,
      deadline_date: trade.deadline_date,
      applied_at: trade.applied_at,
      trader_name: trade.organisations?.name || '',
      buyer_name: trade.buyers?.name || '',
    }));

    return NextResponse.json({
      data: formattedTrades,
      total: count || 0,
      page,
      per_page,
    });
  } catch (error) {
    console.error('GET /api/trades error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// POST /api/trades — Submit new trade application
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const typedUser: User = auth.profile as User;

    if (typedUser.role !== 'trader') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const admin = supabaseAdmin;
    const kycCheck = await assertTraderCanSubmitTrades(admin, typedUser.org_id);
    if (!kycCheck.ok) {
      return NextResponse.json(
        {
          error: 'KYC_REQUIRED',
          code: 'KYC_REQUIRED',
          kyc_status: kycCheck.status,
          message: `${kycCheck.message} Save your application as a draft until verification is complete.`,
        },
        { status: 403 }
      );
    }

    const body: TradeApplicationInput = await request.json();

    if (!body.draft_id) {
      return NextResponse.json(
        {
          error: 'TRADE_DOCUMENTS_REQUIRED',
          message: 'Save your application as a draft and upload all required trade documents before submitting.',
        },
        { status: 422 }
      );
    }

    const { data: draftRow } = await admin
      .from('draft_trades')
      .select('draft_data')
      .eq('id', body.draft_id)
      .eq('trader_org_id', typedUser.org_id)
      .single();

    if (!draftRow) {
      return NextResponse.json({ error: 'DRAFT_NOT_FOUND', message: 'Draft not found.' }, { status: 404 });
    }

    const draftDocuments = ((draftRow.draft_data as Record<string, unknown>)?.trade_documents ||
      []) as TradeDocumentRecord[];

    if (!hasAllRequiredTradeDocs(draftDocuments)) {
      const missing = missingRequiredTradeDocLabels(draftDocuments);
      return NextResponse.json(
        {
          error: 'TRADE_DOCUMENTS_INCOMPLETE',
          message: `Upload all required trade documents before submitting: ${missing.join(', ')}.`,
          missing,
        },
        { status: 422 }
      );
    }

    // Validation
    if (!body.commodity || !body.grade || !body.volume_mt || !body.buyer_id ||
        !body.price_per_mt_usd || !body.procurement_cost_usd ||
        !body.trader_equity_usd || !body.finance_facility_usd ||
        !body.delivery_point || !body.deadline_date || !body.payment_terms_days) {
      return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
    }

    // Business logic validation
    const equityPct = body.trader_equity_usd / body.procurement_cost_usd;
    if (equityPct < 0.35) {
      return NextResponse.json({
        error: 'EQUITY_BELOW_MINIMUM',
        message: 'Trader equity must be at least 35% of procurement cost.',
      }, { status: 422 });
    }

    const totalFunding = body.trader_equity_usd + body.finance_facility_usd;
    if (Math.abs(totalFunding - body.procurement_cost_usd) > 1) {
      return NextResponse.json({
        error: 'FACILITY_MISMATCH',
        message: 'Trader equity + finance facility must equal procurement cost.',
      }, { status: 422 });
    }

    // Calculate derived values
    const contractValue = body.volume_mt * body.price_per_mt_usd;

    // trades.kyc_status is a legacy column (was misused as company KYC). Submissions require org VERIFIED.
    const { data: trade, error } = await (admin
      .from('trades') as any)
      .insert({
        trader_org_id: typedUser.org_id,
        buyer_id: body.buyer_id,
        commodity: body.commodity,
        grade: body.grade,
        volume_mt: body.volume_mt,
        price_per_mt_usd: body.price_per_mt_usd,
        procurement_cost_usd: body.procurement_cost_usd,
        trader_equity_usd: body.trader_equity_usd,
        finance_facility_usd: body.finance_facility_usd,
        delivery_point: body.delivery_point,
        deadline_date: body.deadline_date,
        payment_terms_days: body.payment_terms_days,
        stage: 'SUBMITTED',
        kyc_status: 'VERIFIED',
        capital_deployed_pct: 0,
        applied_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Trade insert error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    const tradeData = trade as any;

    try {
      await migrateDraftDocumentsToTrade(admin, {
        draftId: body.draft_id,
        tradeId: tradeData.id,
        orgId: typedUser.org_id,
        uploadedBy: typedUser.id,
      });
      await admin.from('draft_trades').delete().eq('id', body.draft_id).eq('trader_org_id', typedUser.org_id);
    } catch (docErr) {
      console.error('Draft document migration failed:', docErr);
    }

    // Create empty validation checklist
    await (supabaseAdmin as any)
      .from('trade_validations')
      .insert({ trade_id: tradeData.id });

    // Closure checklist row (required before CLOSED + DB lock semantics)
    const { error: closureErr } = await (supabaseAdmin as any)
      .from('trade_closure_checklists')
      .insert({ trade_id: tradeData.id });
    if (closureErr) {
      console.error('trade_closure_checklists insert error:', closureErr);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    // Notify internal roles (CEO, Ops, Officers) about new submission
    try {
      await notifyNewTradeSubmission(admin, {
        subject: 'New Trade Submitted',
        body: `A new ${tradeData.commodity} trade (${tradeData.trade_ref}) has been submitted for validation.`,
        type: 'TRADE_SUBMITTED',
        tradeId: tradeData.id
      });
    } catch (notifErr) {
      console.error('Submission notification failed:', notifErr);
    }

    // Confirm submission back to the trader
    try {
      const { notifyTraderOrg } = await import('@/lib/notifications');
      await notifyTraderOrg(admin, typedUser.org_id, {
        subject: `Trade ${tradeData.trade_ref} submitted successfully`,
        body: `Your ${tradeData.commodity} trade application (${tradeData.trade_ref}) has been received and is now under validation by our deal team. You will be notified when its status changes.`,
        type: 'TRADE_SUBMITTED',
      });
    } catch (notifErr) {
      console.error('Trader submission confirmation failed:', notifErr);
    }

    return NextResponse.json(tradeData, { status: 201 });
  } catch (error) {
    console.error('POST /api/trades error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}