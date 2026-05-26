import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { getTraderKycGateCopy, reconcileTraderKycStatus } from '@/lib/trader-kyc';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { profile } = auth;
    const admin = supabaseAdmin;

    // 1. Fetch Organization details
    const { data: org, error: orgError } = await admin
      .from('organisations')
      .select('*')
      .eq('id', profile.org_id)
      .single();

    if (orgError) {
      return NextResponse.json({ error: 'ORG_NOT_FOUND', message: orgError.message }, { status: 404 });
    }

    // 2. Fetch Trader Profile (Bank details, etc.)
    const { data: traderProfile, error: profileError } = await admin
      .from('trader_profiles')
      .select('*')
      .eq('org_id', profile.org_id)
      .single();

    const { data: organisation_documents, error: docsError } = await admin
      .from('organisation_documents')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('updated_at', { ascending: false });

    if (docsError) {
      console.error('Organisation documents fetch error:', docsError);
    }

    // Note: traderProfile might be missing if they haven't started onboarding, 
    // but the seed script should have created it.

    const kycStatus = org.kyc_status || 'PENDING';
    const reconciled = await reconcileTraderKycStatus(admin, profile.org_id);
    const effectiveStatus = reconciled.kyc_status;
    const can_submit_trades = reconciled.isFullyVerified;
    const kyc_gate = getTraderKycGateCopy(effectiveStatus);

    return NextResponse.json({
      ...org,
      kyc_status: effectiveStatus,
      is_fully_verified: reconciled.isFullyVerified,
      verification: reconciled.verification,
      traderProfile: traderProfile || {},
      organisation_documents: organisation_documents || [],
      can_submit_trades,
      kyc_gate: {
        title: kyc_gate.title,
        message: kyc_gate.message,
        variant: kyc_gate.variant,
      },
    });

  } catch (error) {
    console.error('GET /api/trader/profile error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
