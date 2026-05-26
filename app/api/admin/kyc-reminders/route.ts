import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { isKycApproverRole } from '@/lib/kyc-approvers';
import { notifyTraderOrg } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/kyc-reminders
 * Sends in-app + email reminders to traders who have been sitting at
 * PENDING status without submitting for KYC review.
 *
 * Body: { days_pending?: number }  — default 3 days
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const auth = await getAuthenticatedUser(token);
    if (!auth || !isKycApproverRole(auth.profile.role)) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const daysPending: number = typeof body.days_pending === 'number' ? body.days_pending : 3;

    const admin = supabaseAdmin;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysPending);

    // Find trader orgs that are still PENDING (never submitted for review)
    // and were created before the cutoff
    const { data: pendingOrgs, error } = await admin
      .from('organisations')
      .select('id, name, created_at')
      .eq('type', 'trader')
      .eq('kyc_status', 'PENDING')
      .lt('created_at', cutoff.toISOString());

    if (error) {
      console.error('kyc-reminders fetch error:', error);
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    const orgs = pendingOrgs || [];
    const results: { org_id: string; name: string; sent: boolean }[] = [];

    for (const org of orgs) {
      try {
        await notifyTraderOrg(admin, org.id, {
          subject: 'Action required: Complete your company verification',
          body: `Your company verification for ${org.name} is still incomplete. To submit trade applications and access funding from Miziba, please complete your business profile, upload the required compliance documents, and submit for review. This is a one-time process.`,
          type: 'KYC_REMINDER',
        });
        results.push({ org_id: org.id, name: org.name, sent: true });
      } catch (e) {
        console.error(`kyc-reminders: failed for org ${org.id}:`, e);
        results.push({ org_id: org.id, name: org.name, sent: false });
      }
    }

    const sent = results.filter(r => r.sent).length;

    return NextResponse.json({
      success: true,
      message: `Reminders sent to ${sent} of ${orgs.length} pending trader organisation(s).`,
      days_pending: daysPending,
      results,
    });
  } catch (error) {
    console.error('POST /api/admin/kyc-reminders error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
