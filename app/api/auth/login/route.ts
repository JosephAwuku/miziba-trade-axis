import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    const { email, password, totp_code } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
    }

    // --- DEVELOPMENT BYPASS START ---
    const TEST_EMAILS: Record<string, any> = {
      'admin@miziba.com': { role: 'ops_admin', name: 'Ops Admin', org: 'TradeAxis Admin' },
      'ceo@miziba.com': { role: 'ceo', name: 'Muazu Abubakar', org: 'Miziba Strategic' },
      'cfo@miziba.com': { role: 'cfo', name: 'Sarah Mensah', org: 'Miziba Strategic' },
      'officer@miziba.com': { role: 'deal_officer', name: 'John Doe', org: 'Miziba Strategic' },
      'trader@miziba.com': { role: 'trader', name: 'Isaac Kobby', org: 'Wenchi Cashew Alliance' },
      'partner@miziba.com': { role: 'finance_partner', name: 'RM - Ecobank', org: 'Ecobank DFI' }
    };

    if (TEST_EMAILS[email]) {
      const mock = TEST_EMAILS[email];
      const mockId = `mock-${mock.role}-${Buffer.from(email).toString('hex').slice(0, 8)}`;
      
      const token = jwt.sign(
        { user: { id: mockId, email: email, role: mock.role } },
        process.env.JWT_SECRET || 'dev-secret-key',
        { expiresIn: '8h' }
      );

      return NextResponse.json({
        token,
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        user: {
          id: mockId,
          email: email,
          full_name: mock.name,
          role: mock.role,
          org_id: 'mock-org-id',
          org_name: mock.org,
          totp_enabled: false,
        },
      });
    }
    // --- DEVELOPMENT BYPASS END ---

    // Get user from database
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        organisations:org_id (
          name
        )
      `)
      .eq('email', email)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid credentials.' }, { status: 401 });
    }

    const userData = user as any;

    if (!userData.is_active) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Account is inactive.' }, { status: 401 });
    }

    // Check lockout
    if (userData.locked_until && new Date(userData.locked_until) > new Date()) {
      return NextResponse.json({
        error: 'ACCOUNT_LOCKED',
        message: `Account locked. Try again after ${userData.locked_until}.`,
      }, { status: 429 });
    }

    // Verify password
    const passwordOk = await bcrypt.compare(password, userData.password_hash);
    if (!passwordOk) {
      const newFailed = (userData.failed_logins || 0) + 1;
      const lockout = newFailed >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null;
      await supabaseAdmin
        .from('users')
        .update({ failed_logins: newFailed, locked_until: lockout })
        .eq('id', userData.id);
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid credentials.' }, { status: 401 });
    }

    // 2FA: Mandatory for financial roles
    const financialRoles = ['ceo', 'cfo'];
    if (financialRoles.includes(userData.role)) {
      if (!userData.totp_enabled || !userData.totp_secret) {
        return NextResponse.json({
          error: '2FA_REQUIRED',
          message: 'Two-factor authentication must be configured before accessing this role. Contact Ops Admin.',
        }, { status: 403 });
      }
      if (!totp_code) {
        return NextResponse.json({
          error: '2FA_CODE_REQUIRED',
          message: 'TOTP code required for this role.',
        }, { status: 403 });
      }
      // TODO: Verify TOTP code
    }

    // Clear failed logins
    await supabaseAdmin
      .from('users')
      .update({ failed_logins: 0, locked_until: null, last_login_at: new Date().toISOString() })
      .eq('id', userData.id);

    // Create JWT token
    const token = jwt.sign(
      { user: { id: userData.id, email: userData.email, role: userData.role } },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: '8h' }
    );

    return NextResponse.json({
      token,
      expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      user: {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        org_id: userData.org_id,
        org_name: userData.organisations?.name || '',
        totp_enabled: userData.totp_enabled,
      },
    });
  } catch (error) {
    console.error('POST /api/auth/login error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}