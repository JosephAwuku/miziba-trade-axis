import { NextRequest, NextResponse } from 'next/server';
import { generateSecret, generateURI } from 'otplib';
import QRCode from 'qrcode';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// POST /api/auth/2fa/setup
//
// SELF-SERVICE ONLY — each user enrolls their own OTP.
// Accepts either a full session token (scope absent) or an onboarding token (scope: onboarding).
// No admin/ceo can set up OTP on behalf of another user.
//
// Returns: { otpauth_url, qr_code_data_url }
// Follow up with POST /api/auth/2fa/verify to activate.

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!rawToken) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let decoded: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      decoded = jwt.verify(rawToken, JWT_SECRET) as any;
    } catch {
      return NextResponse.json({ error: 'INVALID_TOKEN', message: 'Token is invalid or expired.' }, { status: 401 });
    }

    // Accept onboarding tokens (password just changed) or full session tokens
    const userId: string | undefined = decoded?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 });
    }

    // Fetch the user's current state
    const { data: user, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, totp_enabled, totp_secret')
      .eq('id', userId)
      .single();

    if (fetchErr || !user) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = user as any;

    if (u.totp_enabled && u.totp_secret) {
      return NextResponse.json({
        error: 'ALREADY_CONFIGURED',
        message: 'Your 2FA is already active. Use /api/auth/2fa/reset to rotate your secret.',
      }, { status: 409 });
    }

    // Generate new secret + QR
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      strategy: 'totp',
      issuer: 'TradeAxis',
      label: u.email,
      secret,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret but leave totp_enabled=false until verified
    await supabaseAdmin
      .from('users')
      .update({
        totp_secret: secret,
        totp_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    return NextResponse.json({
      success: true,
      otpauth_url: otpauthUrl,
      qr_code_data_url: qrCodeDataUrl,
      message: 'Scan the QR code with your authenticator app, then call POST /api/auth/2fa/verify.',
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('POST /api/auth/2fa/setup error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error?.message }, { status: 500 });
  }
}
