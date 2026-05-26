import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyTotpCode } from '@/lib/totp';
import { getSessionExpiryMinutes, sessionExpiresAtMs } from '@/lib/auth-session';

// POST /api/auth/login
//
// Response shapes:
//   200 next_step: "PASSWORD_CHANGE_REQUIRED"  → user must change their temp password first
//   200 next_step: "MFA_SETUP_REQUIRED"        → user logged in, must enroll OTP before full access
//   200 next_step: "MFA_CODE_REQUIRED"         → user logged in, must supply TOTP code (already enrolled)
//   200 next_step: "DONE"                      → fully authenticated, token issued
//   429                                        → account locked
//   401 / 403                                  → bad credentials or MFA failure

export async function POST(request: NextRequest) {
  try {
    const { email, password, totp_code } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        organisations!users_org_id_fkey (
          name
        )
      `)
      .eq('email', email)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid credentials.' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = user as any;

    if (!u.is_active) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Account is inactive.' }, { status: 401 });
    }

    // Lockout check
    if (u.locked_until && new Date(u.locked_until) > new Date()) {
      return NextResponse.json({
        error: 'ACCOUNT_LOCKED',
        message: `Account locked. Try again after ${u.locked_until}.`,
      }, { status: 429 });
    }

    // Password verification
    const passwordOk = await bcrypt.compare(password, u.password_hash);
    if (!passwordOk) {
      const newFailed = (u.failed_logins || 0) + 1;
      const lockout = newFailed >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null;
      await supabaseAdmin
        .from('users')
        .update({ failed_logins: newFailed, locked_until: lockout })
        .eq('id', u.id);
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid credentials.' }, { status: 401 });
    }

    // ── ONBOARDING GATE 1: forced password change ────────────────────────────
    // If admin set a temp password, user must change it before anything else.
    if (u.must_change_password) {
      // Issue a short-lived onboarding token (no dashboard access)
      const onboardingToken = jwt.sign(
        { user: { id: u.id, email: u.email, role: u.role }, scope: 'onboarding' },
        process.env.JWT_SECRET || 'dev-secret-key',
        { expiresIn: '30m' }
      );
      return NextResponse.json({
        next_step: 'PASSWORD_CHANGE_REQUIRED',
        onboarding_token: onboardingToken,
        user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role },
      });
    }

    // ── ONBOARDING GATE 2: OTP enrollment ────────────────────────────────────
    // User hasn't enrolled their own TOTP yet.
    if (!u.totp_enabled || !u.totp_secret) {
      // Issue a short-lived onboarding token for the MFA enrollment step.
      const onboardingToken = jwt.sign(
        { user: { id: u.id, email: u.email, role: u.role }, scope: 'onboarding' },
        process.env.JWT_SECRET || 'dev-secret-key',
        { expiresIn: '30m' }
      );
      return NextResponse.json({
        next_step: 'MFA_SETUP_REQUIRED',
        onboarding_token: onboardingToken,
        user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role },
      });
    }

    // ── TOTP verification ────────────────────────────────────────────────────
    if (!totp_code) {
      // Password OK, MFA enrolled — just need the code.
      return NextResponse.json({
        next_step: 'MFA_CODE_REQUIRED',
        user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role },
      });
    }

    const totpValid = verifyTotpCode(String(totp_code), u.totp_secret);
    if (!totpValid) {
      return NextResponse.json({ error: 'INVALID_2FA', message: 'Invalid TOTP code.' }, { status: 401 });
    }

    // ── All checks passed — issue full session token ─────────────────────────
    await supabaseAdmin
      .from('users')
      .update({ failed_logins: 0, locked_until: null, last_login_at: new Date().toISOString() })
      .eq('id', u.id);

    const sessionMinutes = getSessionExpiryMinutes(u.role);
    const token = jwt.sign(
      { user: { id: u.id, email: u.email, role: u.role } },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: `${sessionMinutes}m` }
    );

    return NextResponse.json({
      next_step: 'DONE',
      token,
      expires_at: new Date(sessionExpiresAtMs(u.role)).toISOString(),
      user: {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        org_id: u.org_id,
        org_name: u.organisations?.name || '',
        totp_enabled: u.totp_enabled,
      },
    });

  } catch (error) {
    console.error('POST /api/auth/login error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
