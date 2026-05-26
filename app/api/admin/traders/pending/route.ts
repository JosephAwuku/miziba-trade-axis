import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { isKycApproverRole } from '@/lib/kyc-approvers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth || !isKycApproverRole(auth.profile.role)) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'You are not allowed to view the verification queue.' }, { status: 403 });
    }

    const admin = supabaseAdmin;

    // Fetch organizations that are traders and under review
    // Join with trader_profiles to get bank info
    const { data: traders, error } = await admin
      .from('organisations')
      .select(`
        *,
        trader_profiles (*),
        organisation_documents (*),
        users!users_org_id_fkey ( id, email, full_name, role )
      `)
      .eq('type', 'trader')
      .eq('kyc_status', 'UNDER_REVIEW')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Pending traders fetch error:', error);
      return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
    }

    return NextResponse.json(traders);
  } catch (error) {
    console.error('GET /api/admin/traders/pending error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
