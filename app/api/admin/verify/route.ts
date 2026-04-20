import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth || !['ceo', 'ops_admin'].includes(auth.profile.role)) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 403 });
    }

    const { org_id, decision, notes } = await request.json();

    if (!org_id || !decision) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
    }

    const admin = await supabaseAdmin();

    const { error } = await admin
      .from('organisations')
      .update({
        kyc_status: decision === 'VERIFIED' ? 'VERIFIED' : 'REJECTED',
        kyc_verified_at: decision === 'VERIFIED' ? new Date().toISOString() : null,
        kyc_verified_by: decision === 'VERIFIED' ? auth.profile.id : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', org_id);

    if (error) {
      console.error('Verification update error:', error);
      return NextResponse.json({ error: 'UPDATE_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Trader ${decision.toLowerCase()} successfully.` });
  } catch (error) {
    console.error('POST /api/admin/verify error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
