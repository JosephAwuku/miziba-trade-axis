import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/admin/users/reset-mfa
//
// Emergency admin action: revoke a user's TOTP secret and force them to re-enroll.
// Does NOT expose or reveal the old secret — purely clears it.
// Only ops_admin or ceo can call this.

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const auth = await getAuthenticatedUser(token);

    if (!auth || !['ops_admin', 'ceo'].includes(auth.profile.role as string)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { user_id, email } = await request.json().catch(() => ({}));
    if (!user_id && !email) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'user_id or email is required.' }, { status: 422 });
    }

    let query = supabaseAdmin
      .from('users')
      .update({
        totp_secret: null,
        totp_enabled: false,
        mfa_enrolled_at: null,
        updated_at: new Date().toISOString(),
      });

    query = user_id ? query.eq('id', user_id) : query.eq('email', email);

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: 'DB_WRITE_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'MFA has been reset. The user will be prompted to re-enroll on next login.',
    });
  } catch (error: any) {
    console.error('POST /api/admin/users/reset-mfa error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error?.message }, { status: 500 });
  }
}
