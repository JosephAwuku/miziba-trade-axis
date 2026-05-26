import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type DashboardActivity = {
  id: string;
  kind: 'user' | 'audit' | 'webhook';
  title: string;
  subtitle: string;
  timestamp: string;
};

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const auth = await getAuthenticatedUser(token);
    if (!auth || !['ops_admin', 'ceo'].includes(auth.profile.role)) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 403 });
    }

    const admin = supabaseAdmin;

    const [
      { count: pendingVerifications, error: pendingVerificationsError },
      { data: users, error: usersError },
      { data: auditLogs, error: auditLogsError },
      { data: webhookFailures, error: webhookFailuresError },
      { count: failedWebhooksCount, error: failedWebhooksCountError },
    ] = await Promise.all([
      admin
        .from('organisations')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'trader')
        .eq('kyc_status', 'UNDER_REVIEW'),
      admin
        .from('users')
        .select('id, full_name, email, is_active, created_at')
        .order('created_at', { ascending: false }),
      admin
        .from('audit_log')
        .select(`
          id,
          action,
          occurred_at,
          users!audit_log_user_id_fkey (
            full_name
          )
        `)
        .order('occurred_at', { ascending: false })
        .limit(10),
      admin
        .from('webhook_events')
        .select('id, source, event_type, received_at, error')
        .eq('processed', false)
        .order('received_at', { ascending: false })
        .limit(10),
      admin
        .from('webhook_events')
        .select('id', { count: 'exact', head: true })
        .eq('processed', false),
    ]);

    if (pendingVerificationsError || usersError || auditLogsError || webhookFailuresError || failedWebhooksCountError) {
      throw new Error(
        pendingVerificationsError?.message ||
        usersError?.message ||
        auditLogsError?.message ||
        webhookFailuresError?.message ||
        failedWebhooksCountError?.message ||
        'Failed to fetch admin dashboard data'
      );
    }

    const totalUsers = users?.length || 0;
    const activeUsers = (users || []).filter((u: any) => u.is_active).length;

    const recentUserActivities: DashboardActivity[] = (users || []).slice(0, 3).map((u: any) => ({
      id: `user-${u.id}`,
      kind: 'user',
      title: 'User Created',
      subtitle: u.email || u.full_name || 'User record',
      timestamp: u.created_at,
    }));

    const recentAuditActivities: DashboardActivity[] = (auditLogs || []).slice(0, 3).map((a: any) => ({
      id: `audit-${a.id}`,
      kind: 'audit',
      title: String(a.action || 'Audit Event').replace(/_/g, ' '),
      subtitle: a.users?.full_name ? `By ${a.users.full_name}` : 'System event',
      timestamp: a.occurred_at,
    }));

    const recentWebhookActivities: DashboardActivity[] = (webhookFailures || []).slice(0, 3).map((w: any) => ({
      id: `webhook-${w.id}`,
      kind: 'webhook',
      title: `Webhook Failed: ${w.source || 'integration'}`,
      subtitle: w.error || w.event_type || 'Retry required',
      timestamp: w.received_at,
    }));

    const activities = [...recentUserActivities, ...recentAuditActivities, ...recentWebhookActivities]
      .filter((a) => !!a.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);

    return NextResponse.json({
      pending_verifications: pendingVerifications || 0,
      total_users: totalUsers,
      active_users: activeUsers,
      failed_webhooks: failedWebhooksCount || 0,
      activities,
      source: 'database',
    });
  } catch (error) {
    console.error('GET /api/admin/dashboard error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
