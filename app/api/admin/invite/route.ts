import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth || !['ceo', 'ops_admin'].includes(auth.profile.role)) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Only CEO or Ops Admin can invite traders.' }, { status: 403 });
    }

    const { name, email, org_name, role = 'trader', temp_password = 'Welcome123!' } = await request.json();

    if (!name || !email || !org_name) {
      return NextResponse.json({ error: 'MISSING_FIELDS', message: 'Name, email, and organization name are required.' }, { status: 400 });
    }

    const admin = await supabaseAdmin;

    // 1. Create Organization
    const { data: org, error: orgError } = await admin
      .from('organisations')
      .insert({
        name: org_name,
        type: role === 'trader' ? 'trader' : (role === 'finance_partner' || role === 'fp' ? 'partner' : 'internal'),
        kyc_status: role === 'trader' ? 'PENDING' : 'VERIFIED',
        country: 'GH'
      })
      .select()
      .single();

    if (orgError) {
      console.error('Org creation error:', orgError);
      return NextResponse.json({ error: 'ORG_CREATE_FAILED', message: orgError.message }, { status: 500 });
    }

    // 2. Hash Password
    const passwordHash = await bcrypt.hash(temp_password, 12);

    // 3. Create User
    const { data: user, error: userError } = await admin
      .from('users')
      .insert({
        org_id: org.id,
        email,
        full_name: name,
        role: role,
        password_hash: passwordHash,
        is_active: true
      })
      .select()
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      return NextResponse.json({ error: 'USER_CREATE_FAILED', message: userError.message }, { status: 500 });
    }

    // 4. Create Role-Specific Profile
    if (role === 'trader') {
      const { error: profileError } = await admin
        .from('trader_profiles')
        .insert({
          org_id: org.id,
          equity_min_pct: 35.00,
          trades_completed: 0,
          total_volume_mt: 0,
          total_value_usd: 0
        });
      if (profileError) console.error('Trader Profile creation error:', profileError);
    } else if (role === 'finance_partner' || role === 'fp') {
      const { error: partnerError } = await admin
        .from('finance_partner_profiles')
        .insert({
          org_id: org.id,
          facility_limit_usd: 5000000.00,
          deployed_usd: 0,
          risk_appetite: 'MODERATE'
        });
      if (partnerError) console.error('Partner Profile creation error:', partnerError);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        org_id: org.id,
        org_name: org.name
      }
    });

  } catch (error) {
    console.error('POST /api/admin/invite error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Something went wrong.' }, { status: 500 });
  }
}
