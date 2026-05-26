import { NextRequest, NextResponse } from 'next/server';
import { verifyTotpCode } from '@/lib/totp';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';
import { getSessionExpiryMinutes, sessionExpiresAtMs } from '@/lib/auth-session';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// POST /api/auth/2fa/verify
//
// SELF-SERVICE ONLY — verifies the TOTP code the user just scanned and activates their MFA.
// Accepts onboarding tokens or full session tokens.
// On success during onboarding: returns a full session token (next_step: DONE).

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
      return NextResponse.json({ error: 'INVALID_TOKEN', message: 'Token is invalid or expired.' }, { status: 401 });
    }

    const userId: string | undefined = decoded?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 });
    }

    const { totp_code } = await request.json().catch(() => ({}));
    if (!totp_code || String(totp_code).length !== 6) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'A 6-digit TOTP code is required.' }, { status: 422 });
    }

    const { data: user, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, org_id, totp_secret, totp_enabled, organisations!users_org_id_fkey(name)')
      .eq('id', userId)
      .single();

    if (fetchErr || !user) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const u = user as any;

    if (!u.totp_secret) {
      return NextResponse.json({ error: 'NOT_SETUP', message: 'Call POST /api/auth/2fa/setup first.' }, { status: 400 });
    }

    const valid = verifyTotpCode(String(totp_code), u.totp_secret);
    if (!valid) {
      return NextResponse.json({ error: 'INVALID_2FA', message: 'Incorrect TOTP code. Try again.' }, { status: 401 });
    }

    // Detect whether this is the very first 2FA enrollment (first login completion)
    const isFirstLogin = !u.totp_enabled && !u.mfa_enrolled_at;

    // Activate MFA
    await supabaseAdmin
      .from('users')
      .update({
        totp_enabled: true,
        mfa_enrolled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // Issue a full session token — onboarding is now complete
    await supabaseAdmin
      .from('users')
      .update({ failed_logins: 0, locked_until: null, last_login_at: new Date().toISOString() })
      .eq('id', userId);

    // Send first-login welcome notification (dashboard + mirrored to email)
    if (isFirstLogin) {
      const orgName = u.organisations?.name || 'your organisation';
      const isTrader = u.role === 'trader';
      const welcomeBody = isTrader
        ? `Welcome to TradeAxis, ${u.full_name || u.email}. Your account for ${orgName} is now active. To start submitting trade applications, complete your company verification: fill in your business profile, upload compliance documents, and submit for CEO or Operations Admin approval.`
        : `Welcome to TradeAxis, ${u.full_name || u.email}. Your account is now active and your 2FA is set up. You're all set to get started.`;

      createNotification(supabaseAdmin, {
        userId: u.id,
        subject: `Welcome to TradeAxis${isTrader ? ' — complete your verification to start trading' : ''}`,
        body: welcomeBody,
        type: 'WELCOME',
      }).catch((e) => console.error('[notify] Welcome message failed:', e));
    }

    const sessionMinutes = getSessionExpiryMinutes(u.role);
    const sessionToken = jwt.sign(
      { user: { id: u.id, email: u.email, role: u.role } },
      JWT_SECRET,
      { expiresIn: `${sessionMinutes}m` }
    );

    return NextResponse.json({
      next_step: 'DONE',
      token: sessionToken,
      expires_at: new Date(sessionExpiresAtMs(u.role)).toISOString(),
      user: {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        org_id: u.org_id,
        org_name: u.organisations?.name || '',
        totp_enabled: true,
      },
    });

  } catch (error: any) {
    console.error('POST /api/auth/2fa/verify error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error?.message }, { status: 500 });
  }
}
