import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { notifyTraderOrg } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

// This endpoint is called automatically by Vercel Cron (configured in vercel.json).
// It is also protected by CRON_SECRET so it cannot be triggered by arbitrary requests.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }

  const admin = supabaseAdmin;
  const now = new Date();
  const results: { org_id: string; name: string; reason: string; sent: boolean }[] = [];

  // ── Window thresholds ────────────────────────────────────────────────────────
  const pendingCutoff = new Date(now);
  pendingCutoff.setDate(pendingCutoff.getDate() - 2); // PENDING > 2 days

  const underReviewCutoff = new Date(now);
  underReviewCutoff.setDate(underReviewCutoff.getDate() - 7); // UNDER_REVIEW > 7 days

  const reminderWindow = new Date(now);
  reminderWindow.setDate(reminderWindow.getDate() - 3); // Don't re-notify within 3 days

  // ── Fetch candidate orgs ────────────────────────────────────────────────────
  const { data: pendingOrgs } = await admin
    .from('organisations')
    .select('id, name, created_at')
    .eq('type', 'trader')
    .eq('kyc_status', 'PENDING')
    .lt('created_at', pendingCutoff.toISOString());

  const { data: stuckOrgs } = await admin
    .from('organisations')
    .select('id, name, updated_at')
    .eq('type', 'trader')
    .eq('kyc_status', 'UNDER_REVIEW')
    .lt('updated_at', underReviewCutoff.toISOString());

  const candidates: { org_id: string; name: string; reason: 'pending' | 'stuck_review' }[] = [
    ...(pendingOrgs || []).map((o: any) => ({ org_id: o.id as string, name: o.name as string, reason: 'pending' as const })),
    ...(stuckOrgs || []).map((o: any) => ({ org_id: o.id as string, name: o.name as string, reason: 'stuck_review' as const })),
  ];

  for (const candidate of candidates) {
    // Check if we already sent a KYC_REMINDER to any user in this org recently
    const { data: recentUsers } = await admin
      .from('users')
      .select('id')
      .eq('org_id', candidate.org_id)
      .eq('is_active', true);

    const userIds = (recentUsers || []).map((u: any) => u.id);
    if (userIds.length === 0) continue;

    const { data: recentReminder } = await admin
      .from('notifications')
      .select('id')
      .in('user_id', userIds)
      .eq('type', 'KYC_REMINDER')
      .gte('created_at', reminderWindow.toISOString())
      .limit(1)
      .maybeSingle();

    if (recentReminder) {
      // Reminder was already sent within the last 3 days — skip
      results.push({ ...candidate, sent: false });
      continue;
    }

    const subject =
      candidate.reason === 'pending'
        ? 'Action required: Complete your company verification'
        : 'Verification update: Your submission is still under review';

    const body =
      candidate.reason === 'pending'
        ? `Your company verification for ${candidate.name} is still incomplete. Fill in your business profile, upload the required compliance documents, and submit for review. You cannot submit trade applications until verification is approved.`
        : `Your KYC submission for ${candidate.name} has been under review for more than a week. Our compliance team will contact you if any additional information is needed. No action is required from you at this time.`;

    try {
      await notifyTraderOrg(admin, candidate.org_id, {
        subject,
        body,
        type: 'KYC_REMINDER',
      });
      results.push({ ...candidate, sent: true });
    } catch (e) {
      console.error(`cron/kyc-reminders: failed for org ${candidate.org_id}:`, e);
      results.push({ ...candidate, sent: false });
    }
  }

  const sent = results.filter(r => r.sent).length;
  console.log(`[cron/kyc-reminders] Processed ${candidates.length} orgs, sent ${sent} reminders.`);

  return NextResponse.json({
    ok: true,
    processed: candidates.length,
    sent,
    results,
  });
}
