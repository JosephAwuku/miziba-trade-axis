import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { isKycApproverRole } from '@/lib/kyc-approvers';
import { getTraderVerificationStatus } from '@/lib/trader-kyc';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth || !isKycApproverRole(auth.profile.role)) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'You are not allowed to view trader verification status.' },
        { status: 403 }
      );
    }
    const admin = supabaseAdmin;

    const status = await getTraderVerificationStatus(admin, orgId);

    return NextResponse.json(status);

  } catch (error) {
    console.error('GET /api/admin/traders/[id]/verification-status error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
