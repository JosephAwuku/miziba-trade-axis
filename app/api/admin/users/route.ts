import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { User } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    // 1. Authenticate & Authorize
    const auth = await getAuthenticatedUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const typedUser = auth.profile as User;
    const allowedRoles = ['ceo', 'ops_admin'];

    if (!allowedRoles.includes(typedUser.role as string)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const admin = supabaseAdmin;

    // 2. Fetch Users with Organisation details
    // Joining with organisations and trader_profiles for active status/metrics
    const { data: users, error: usersError } = await admin
      .from('users')
      .select(`
        id,
        full_name,
        email,
        role,
        is_active,
        totp_enabled,
        failed_logins,
        locked_until,
        must_change_password,
        mfa_enrolled_at,
        created_at,
        created_by,
        organisations!users_org_id_fkey (
          id,
          name,
          kyc_status
        )
      `)
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('User fetch error:', usersError);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    // 3. Fetch Trade Counts per Organisation
    // This allows us to show "12 Deals" in the traders tab
    const { data: trades, error: tradesError } = await admin
      .from('trades')
      .select('trader_org_id');

    const tradeCounts: Record<string, number> = {};
    trades?.forEach((t: any) => {
      tradeCounts[t.trader_org_id] = (tradeCounts[t.trader_org_id] || 0) + 1;
    });

    // 4. Transform to Hub Format
    const formattedData = users?.map((u: any) => {
      const org = (u.organisations as any);
      return {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        is_active: u.is_active,
        totp_enabled: u.totp_enabled || false,
        failed_logins: u.failed_logins || 0,
        locked_until: u.locked_until || null,
        must_change_password: u.must_change_password || false,
        mfa_enrolled_at: u.mfa_enrolled_at || null,
        org_id: org?.id || null,
        org_name: org?.name || 'Miziba Strategic',
        kyc_status: org?.kyc_status || null,
        trade_count: org?.id ? (tradeCounts[org.id] || 0) : 0,
        created_at: u.created_at,
        /** When CEO/Ops Admin created this account via invite; same instant as created_at on insert */
        admin_added_at: u.created_by ? u.created_at : null,
      };
    });

    return NextResponse.json({
      data: formattedData,
      meta: {
        source: 'database',
        endpoint: '/api/admin/users'
      }
    });
  } catch (error) {
    console.error('GET /api/admin/users internal error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
