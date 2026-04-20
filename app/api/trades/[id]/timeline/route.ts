export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

// GET /api/trades/[id]/timeline — Get audit trail/timeline for a trade
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tradeId } = await params;
    const auth = await getAuthenticatedUser();

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const admin = await supabaseAdmin();

    // Fetch audit logs for this specific trade
    const { data: logs, error } = await (admin
      .from('audit_log') as any) // Match schema.sql: audit_log (singular)
      .select(`
        *,
        users (
          full_name,
          role
        )
      `)
      .eq('trade_id', tradeId) // Match schema.sql: trade_id
      .order('occurred_at', { ascending: false }); // Match schema.sql: occurred_at

    if (error) {
      console.error('Timeline fetch error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    const processedTimeline = (logs || []).map((log: any) => ({
      id: log.id,
      timestamp: log.occurred_at,
      action: log.action,
      user: log.users?.full_name || 'System',
      role: log.users?.role || 'Automated',
      details: log.details || {},
    }));

    return NextResponse.json(processedTimeline);
  } catch (error) {
    console.error('GET /api/trades/[id]/timeline error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
