import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getSessionExpiryMinutes } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// POST /api/auth/change-password
//
// Called during the PASSWORD_CHANGE_REQUIRED onboarding step.
// Accepts the onboarding_token (short-lived, scope: onboarding) issued by login.
// Enforces: new password !== old/temp password, min length 12.
// On success: clears must_change_password, returns MFA_SETUP_REQUIRED if OTP not yet enrolled.

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!rawToken) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(rawToken, JWT_SECRET) as any;
    } catch {
      return NextResponse.json({ error: 'INVALID_TOKEN', message: 'Onboarding token is invalid or expired.' }, { status: 401 });
    }

    // Only onboarding-scoped tokens may hit this endpoint
    if (decoded?.scope !== 'onboarding') {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Only onboarding tokens can change password here.' }, { status: 403 });
    }

    const userId = decoded?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 });
    }

    const { new_password } = await request.json().catch(() => ({}));

    if (!new_password || new_password.length < 12) {
      return NextResponse.json({
        error: 'VALIDATION_ERROR',
        message: 'New password must be at least 12 characters.',
      }, { status: 422 });
    }

    // Fetch current hash to prevent reusing the temp password
    const { data: user, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('id, email, role, password_hash, totp_enabled, totp_secret, must_change_password, organisations!users_org_id_fkey(name)')
      .eq('id', userId)
      .single();

    if (fetchErr || !user) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const u = user as any;

    if (!u.must_change_password) {
      return NextResponse.json({ error: 'NOT_REQUIRED', message: 'Password change is not required for this account.' }, { status: 409 });
    }

    // Prevent reusing the temporary password
    const isSameAsCurrent = await bcrypt.compare(new_password, u.password_hash);
    if (isSameAsCurrent) {
      return NextResponse.json({
        error: 'VALIDATION_ERROR',
        message: 'New password must be different from your temporary password.',
      }, { status: 422 });
    }

    const newHash = await bcrypt.hash(new_password, 12);

    await supabaseAdmin
      .from('users')
      .update({
        password_hash: newHash,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // Determine what the user must do next
    if (!u.totp_enabled || !u.totp_secret) {
      // Issue fresh onboarding token for the OTP enrollment step
      const onboardingToken = jwt.sign(
        { user: { id: u.id, email: u.email, role: u.role }, scope: 'onboarding' },
        JWT_SECRET,
        { expiresIn: '30m' }
      );
      return NextResponse.json({
        next_step: 'MFA_SETUP_REQUIRED',
        onboarding_token: onboardingToken,
        user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role },
      });
    }

    // OTP already enrolled — issue a regular session token (edge case: admin who had OTP)
    const sessionMinutes = getSessionExpiryMinutes(u.role);
    const token = jwt.sign(
      { user: { id: u.id, email: u.email, role: u.role } },
      JWT_SECRET,
      { expiresIn: `${sessionMinutes}m` }
    );
    return NextResponse.json({
      next_step: 'MFA_CODE_REQUIRED',
      onboarding_token: token,
      user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role },
    });

  } catch (error: any) {
    console.error('POST /api/auth/change-password error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error?.message }, { status: 500 });
  }
}
