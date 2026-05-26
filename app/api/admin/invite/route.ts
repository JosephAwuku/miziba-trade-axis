import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { sendInviteWelcomeEmail } from '@/lib/email';
import { notifyTraderOrg } from '@/lib/notifications';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// POST /api/admin/invite
//
// Only ops_admin and ceo can create users.
// New users are created with:
//   - must_change_password = true  → forced reset on first login
//   - totp_enabled = false          → user self-enrolls OTP after password reset
//   - created_by = actor.id

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const auth = await getAuthenticatedUser(token);
    if (!auth || !['ceo', 'ops_admin'].includes(auth.profile.role as string)) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Only CEO or Ops Admin can create users.' }, { status: 403 });
    }

    const actor = auth.profile as any;

    const {
      name,
      email,
      org_name,
      role = 'trader',
      temp_password = 'Welcome123!',
    } = await request.json();

    if (!name || !email || !org_name) {
      return NextResponse.json({ error: 'MISSING_FIELDS', message: 'Name, email, and organization name are required.' }, { status: 400 });
    }

    if (!email.includes('@')) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Please provide a valid email address.' }, { status: 422 });
    }

    const allowedRoles = ['trader', 'finance_partner', 'deal_officer', 'cfo', 'ceo', 'ops_admin'];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: `Invalid role: ${role}` }, { status: 422 });
    }

    // Only ops_admin can create another ops_admin
    if (role === 'ops_admin' && actor.role !== 'ops_admin') {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Only Ops Admin can create another Ops Admin account.' }, { status: 403 });
    }

    // Check email not already in use
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'CONFLICT', message: 'An account with this email already exists.' }, { status: 409 });
    }

    // 1. Create Organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organisations')
      .insert({
        name: org_name,
        type: role === 'trader' ? 'trader' : (role === 'finance_partner' ? 'finance_partner' : 'miziba'),
        kyc_status: role === 'trader' ? 'PENDING' : 'VERIFIED',
        country: 'GH',
      })
      .select()
      .single();

    if (orgError) {
      return NextResponse.json({ error: 'ORG_CREATE_FAILED', message: orgError.message }, { status: 500 });
    }

    // 2. Hash the temporary password
    const passwordHash = await bcrypt.hash(temp_password, 12);

    // 3. Create User — force onboarding flags
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        org_id: org.id,
        email,
        full_name: name,
        role,
        password_hash: passwordHash,
        is_active: true,
        totp_enabled: false,
        must_change_password: true,   // user must reset on first login
        created_by: actor.id,
      })
      .select()
      .single();

    if (userError) {
      return NextResponse.json({ error: 'USER_CREATE_FAILED', message: userError.message }, { status: 500 });
    }

    // 4. Create role-specific profile
    if (role === 'trader') {
      await supabaseAdmin.from('trader_profiles').insert({
        org_id: org.id,
        equity_min_pct: 35.00,
        trades_completed: 0,
        total_volume_mt: 0,
        total_value_usd: 0,
      });
    } else if (role === 'finance_partner') {
      await supabaseAdmin.from('finance_partner_profiles').insert({
        org_id: org.id,
        facility_limit_usd: 5000000.00,
        deployed_usd: 0,
        risk_appetite: 'MODERATE',
      });
    }

    // Send first-login in-app notification for traders to complete verification
    if (role === 'trader') {
      try {
        await notifyTraderOrg(supabaseAdmin, org.id, {
          subject: 'Complete your company verification to start trading',
          body: 'Welcome to TradeAxis. To submit trade applications and access funding, you must complete your company verification: fill in your business profile, upload required compliance documents, and submit for CEO or Operations Admin approval.',
          type: 'KYC_REMINDER',
        });
      } catch (e) {
        console.error('[notify] First-login KYC reminder failed:', e);
      }
    }

    const emailResult = await sendInviteWelcomeEmail({
      to: email,
      recipientName: name,
      role,
      orgName: org_name,
      temporaryPassword: temp_password,
    });
    if (!emailResult.ok && !emailResult.skipped) {
      console.error('[email] Invite welcome send failed:', emailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: `Account created. ${name} must change their password and set up 2FA on first login.`,
      email_delivery: {
        sent: emailResult.ok === true,
        skipped: emailResult.skipped === true,
        error: emailResult.ok ? undefined : emailResult.error,
        resend_id: emailResult.ok ? emailResult.id : undefined,
      },
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        org_id: org.id,
        org_name: org.name,
        must_change_password: true,
      },
    });

  } catch (error: any) {
    console.error('POST /api/admin/invite error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
  }
}
