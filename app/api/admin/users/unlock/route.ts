import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const auth = await getAuthenticatedUser(token);

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const actor = auth.profile as any;
    if (actor.role !== 'ops_admin') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { user_id, email } = await request.json().catch(() => ({}));
    if (!user_id && !email) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'user_id or email is required.' }, { status: 422 });
    }

    let query = supabaseAdmin
      .from('users')
      .update({
        failed_logins: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      });

    query = user_id ? query.eq('id', user_id) : query.eq('email', email);

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: 'DB_WRITE_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'User account unlocked.' });
  } catch (error: any) {
    console.error('POST /api/admin/users/unlock error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error?.message || 'Something went wrong.' }, { status: 500 });
  }
}
