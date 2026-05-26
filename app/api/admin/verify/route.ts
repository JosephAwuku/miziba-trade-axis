import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { notifyTraderOrg } from '@/lib/notifications';
import { isKycApproverRole } from '@/lib/kyc-approvers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth || !isKycApproverRole(auth.profile.role)) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'You are not allowed to approve trader KYC.' }, { status: 403 });
    }

    const { org_id, decision, notes } = await request.json();

    if (!org_id || !decision) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
    }

    const admin = supabaseAdmin;
    const now = new Date().toISOString();
    const adminId = auth.profile.id;
    const isApproved = decision === 'VERIFIED';

    // Update org — including granular profile verification flag
    const { error } = await admin
      .from('organisations')
      .update({
        kyc_status: isApproved ? 'VERIFIED' : 'REJECTED',
        kyc_verified_at: isApproved ? now : null,
        kyc_verified_by: isApproved ? adminId : null,
        // Granular columns (added in migration 0008 — silently ignored if not yet migrated)
        company_profile_verified: isApproved,
        company_profile_verified_by: adminId,
        company_profile_verified_at: isApproved ? now : null,
        company_profile_rejection_notes: isApproved ? null : (notes || 'Verification not approved'),
        updated_at: now,
      })
      .eq('id', org_id);

    if (error) {
      console.error('Verification update error:', error);
      return NextResponse.json({ error: 'UPDATE_FAILED', message: error.message }, { status: 500 });
    }

    // Update trader_profiles granular bank verification flag
    await admin
      .from('trader_profiles')
      .update({
        bank_details_verified: isApproved,
        bank_details_verified_by: adminId,
        bank_details_verified_at: isApproved ? now : null,
        bank_details_rejection_notes: isApproved ? null : (notes || 'Verification not approved'),
        updated_at: now,
      })
      .eq('org_id', org_id);

    // Update all organisation documents
    await admin
      .from('organisation_documents')
      .update({
        status: isApproved ? 'VERIFIED' : 'REJECTED',
        reviewed_by: adminId,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('org_id', org_id);

    const bodyVerified = 'Your company verification is complete. You may submit trade applications.';
    const bodyRejected = `Your company verification was not approved.${notes ? ` Note: ${notes}` : ' Please contact support or re-submit documents when ready.'}`;

    await notifyTraderOrg(admin, org_id, {
      subject: isApproved ? 'Company verification approved' : 'Company verification update',
      body: isApproved ? bodyVerified : bodyRejected,
      type: isApproved ? 'KYC_VERIFIED' : 'KYC_REJECTED',
    });

    return NextResponse.json({ success: true, message: `Trader ${decision.toLowerCase()} successfully.` });
  } catch (error) {
    console.error('POST /api/admin/verify error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
