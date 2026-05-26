export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const auth = await getAuthenticatedUser(token);

    if (!auth || !['ops_admin', 'ceo'].includes(auth.profile.role)) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(100, Math.max(10, parseInt(searchParams.get('per_page') || '25', 10)));
    const action = searchParams.get('action')?.trim();
    const tradeId = searchParams.get('trade_id')?.trim();
    const userId = searchParams.get('user_id')?.trim();
    const search = searchParams.get('search')?.trim();
    const fromDate = searchParams.get('from_date')?.trim();
    const toDate = searchParams.get('to_date')?.trim();

    const admin = supabaseAdmin;
    let query = admin
      .from('audit_log')
      .select(
        `
          id,
          user_id,
          trade_id,
          action,
          entity_type,
          entity_id,
          old_value,
          new_value,
          ip_address,
          occurred_at,
          users!audit_log_user_id_fkey (
            full_name,
            email,
            role
          ),
          trades (
            trade_ref
          )
        `,
        { count: 'exact' }
      )
      .order('occurred_at', { ascending: false });

    if (action) query = query.ilike('action', `%${action}%`);
    if (tradeId) query = query.eq('trade_id', tradeId);
    if (userId) query = query.eq('user_id', userId);
    if (fromDate) query = query.gte('occurred_at', fromDate);
    if (toDate) query = query.lte('occurred_at', `${toDate}T23:59:59.999Z`);
    if (search) {
      query = query.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%`);
    }

    const from = (page - 1) * perPage;
    const { data, error, count } = await query.range(from, from + perPage - 1);

    if (error) {
      console.error('GET /api/admin/audit-log error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    const entries = (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      user_name: row.users?.full_name || 'System',
      user_email: row.users?.email,
      user_role: row.users?.role,
      trade_id: row.trade_id,
      trade_ref: row.trades?.trade_ref,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      old_value: row.old_value,
      new_value: row.new_value,
      ip_address: row.ip_address,
      occurred_at: row.occurred_at,
    }));

    return NextResponse.json({
      data: entries,
      total: count ?? 0,
      page,
      per_page: perPage,
    });
  } catch (error) {
    console.error('GET /api/admin/audit-log unexpected error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
