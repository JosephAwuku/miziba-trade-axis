import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { notifyKycSubmission } from '@/lib/notifications';
import { assertRequiredKycDocumentsUploaded } from '@/lib/trader-kyc';

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

    const docCheck = await assertRequiredKycDocumentsUploaded(admin, profile.org_id);
    if (!docCheck.ok) {
      return NextResponse.json(
        {
          error: 'KYC_DOCUMENTS_INCOMPLETE',
          message: `Upload all required documents before submitting: ${docCheck.missing.join(', ')}`,
          missing: docCheck.missing,
        },
        { status: 422 }
      );
    }

    const orgPatch: Record<string, unknown> = {
      registration_no: data.registrarNumber,
      tin: data.tinNumber,
      address: data.address,
      kyc_status: 'UNDER_REVIEW',
      updated_at: new Date().toISOString(),
    };
    if (typeof data.companyName === 'string' && data.companyName.trim()) {
      orgPatch.name = data.companyName.trim();
    }

    const { error: orgError } = await admin.from('organisations').update(orgPatch).eq('id', profile.org_id);

    if (orgError) {
      console.error('Org update error:', orgError);
      return NextResponse.json({ error: 'UPDATE_FAILED', message: orgError.message }, { status: 500 });
    }

    const { error: profileError } = await admin
      .from('trader_profiles')
      .update({
        bank_name: data.bankName,
        bank_account_number: data.accountNumber,
        bank_account_branch: data.accountBranch,
        bank_swift: data.swiftCode,
        bank_account_name: data.companyName,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', profile.org_id);

    if (profileError) {
      console.error('Profile update error:', profileError);
    }

    await admin
      .from('organisation_documents')
      .update({ status: 'UNDER_REVIEW', updated_at: new Date().toISOString() })
      .eq('org_id', profile.org_id)
      .in('status', ['UPLOADED']);

    const { data: orgRow } = await admin.from('organisations').select('name').eq('id', profile.org_id).single();
    const orgLabel = (orgRow as { name?: string } | null)?.name || 'Trader organisation';

    try {
      await notifyKycSubmission(admin, {
        subject: 'Trader KYC submitted for review',
        body: `${orgLabel} (organisation ${profile.org_id}) has submitted company verification. Open Required Action to review documents and approve or reject.`,
        type: 'KYC_SUBMITTED',
      });
    } catch (e) {
      console.error('KYC submit notification failed:', e);
    }

    return NextResponse.json({ success: true, message: 'Onboarding data submitted for review.' });
  } catch (error) {
    console.error('POST /api/trader/onboard error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Something went wrong.' }, { status: 500 });
  }
}
