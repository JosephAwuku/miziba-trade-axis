import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth || auth.profile.role !== 'trader') {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Only traders can submit onboarding data.' }, { status: 403 });
    }

    const { profile } = auth;
    const data = await request.json();

    const admin = supabaseAdmin;

    // 1. Update Organization (KYC details)
    const { error: orgError } = await admin
      .from('organisations')
      .update({
        registration_no: data.registrarNumber,
        tin: data.tinNumber,
        address: data.address,
        kyc_status: 'UNDER_REVIEW', // Phase 2: Move to Review
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.org_id);

    if (orgError) {
      console.error('Org update error:', orgError);
      return NextResponse.json({ error: 'UPDATE_FAILED', message: orgError.message }, { status: 500 });
    }

    // 2. Update Trader Profile (Bank details)
    const { error: profileError } = await admin
      .from('trader_profiles')
      .update({
        bank_name: data.bankName,
        bank_account_number: data.accountNumber,
        bank_swift: data.swiftCode,
        bank_account_name: data.companyName, // Usually matches legal name
        updated_at: new Date().toISOString()
      })
      .eq('org_id', profile.org_id);

    if (profileError) {
      console.error('Profile update error:', profileError);
    }

    return NextResponse.json({ success: true, message: 'Onboarding data submitted for review.' });

  } catch (error) {
    console.error('POST /api/trader/onboard error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Something went wrong.' }, { status: 500 });
  }
}
