import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { isKycApproverRole } from '@/lib/kyc-approvers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth || !isKycApproverRole(auth.profile.role)) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'You are not allowed to view trader KYC details.' }, { status: 403 });
    }

    const admin = supabaseAdmin;
    const orgId = id;

    // Fetch the specific organization details
    const { data: org, error: orgError } = await admin
      .from('organisations')
      .select(`
        *,
        trader_profiles (*),
        organisation_documents (*),
        users!users_org_id_fkey ( id, email, full_name, role )
      `)
      .eq('id', orgId)
      .single();

    if (orgError) {
      console.error('Admin fetch trader profile error:', orgError);
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Trader organization not found.' }, { status: 404 });
    }

    // Transform to match the structure expected by the UI
    const result = {
        ...org,
        traderProfile: org.trader_profiles?.[0] || {}
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('GET /api/admin/traders/[id] error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
  }
}
