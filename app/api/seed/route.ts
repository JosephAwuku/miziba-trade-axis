import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function GET() {
  // Guard: only allow seeding when explicitly enabled via environment variable.
  // Set ALLOW_SEED=true in .env.local for local development only.
  // This variable must NEVER be set in production.
  if (process.env.ALLOW_SEED !== 'true') {
    return NextResponse.json({ error: 'FORBIDDEN', message: 'Seeding is disabled in this environment.' }, { status: 403 });
  }

  try {
    const admin = supabaseAdmin;
    if (!admin) {
        return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

    // 1. Create Organizations
    const orgs = [
      { name: 'Miziba Strategic', type: 'miziba', country: 'GH' },
      { name: 'TradeAxis Admin', type: 'miziba', country: 'GH' },
      { name: 'Wenchi Cashew Alliance', type: 'trader', country: 'GH' },
      { name: 'Ecobank DFI', type: 'finance_partner', country: 'GH' },
    ];

    const orgMap: Record<string, string> = {};
    for (const org of orgs) {
      // Check if exists
      const { data: existingOrg } = await admin.from('organisations').select('id, name').eq('name', org.name).single();
      if (existingOrg) {
        orgMap[org.name] = existingOrg.id;
      } else {
        const { data: newOrg, error } = await admin.from('organisations').insert({
          name: org.name,
          type: org.type,
          country: org.country,
          kyc_status: 'VERIFIED'
        }).select().single();
        if (error) throw error;
        orgMap[org.name] = newOrg.id;
      }
    }

    // 2. Create Buyers
    const buyers = [
      { name: 'Olam International', country: 'SG', sanctions_clear: true, creditworthiness_score: 85 },
      { name: 'Valency International', country: 'SG', sanctions_clear: true, creditworthiness_score: 92 },
    ];

    for (const buyer of buyers) {
      const { data: existingBuyer } = await admin.from('buyers').select('id').eq('name', buyer.name).single();
      if (!existingBuyer) {
         const { error } = await admin.from('buyers').insert(buyer);
         if (error) throw error;
      }
    }

    // 3. Create Profiles
    const { data: tp } = await admin.from('trader_profiles').select('org_id').eq('org_id', orgMap['Wenchi Cashew Alliance']).single();
    if (!tp) {
       await admin.from('trader_profiles').insert({
           org_id: orgMap['Wenchi Cashew Alliance'],
           bank_account_name: 'Wenchi Cashew Alliance',
           bank_name: 'GCB Bank',
           export_licence_ref: 'GH-EXP-2026-988'
       });
    }

    const { data: fpp } = await admin.from('finance_partner_profiles').select('org_id').eq('org_id', orgMap['Ecobank DFI']).single();
    if (!fpp) {
       await admin.from('finance_partner_profiles').insert({
           org_id: orgMap['Ecobank DFI'],
           contact_name: 'Partner RM',
           onboarding_done: true,
           framework_signed: true,
           portal_active: true
       });
    }

    // 4. Create Users
    const defaultPassword = await bcrypt.hash('TradeAxis2026!', 10);
    const users = [
      { email: 'admin@miziba.com', full_name: 'Ops Admin', role: 'ops_admin', org_id: orgMap['TradeAxis Admin'] },
      { email: 'ceo@miziba.com', full_name: 'Muazu Abubakar', role: 'ceo', org_id: orgMap['Miziba Strategic'] },
      { email: 'cfo@miziba.com', full_name: 'Sarah Mensah', role: 'cfo', org_id: orgMap['Miziba Strategic'] },
      { email: 'officer@miziba.com', full_name: 'John Doe', role: 'deal_officer', org_id: orgMap['Miziba Strategic'] },
      { email: 'trader@miziba.com', full_name: 'Isaac Kobby', role: 'trader', org_id: orgMap['Wenchi Cashew Alliance'] },
      { email: 'partner@miziba.com', full_name: 'RM - Ecobank', role: 'finance_partner', org_id: orgMap['Ecobank DFI'] },
    ];

    for (const u of users) {
      const { data: existingUser } = await admin.from('users').select('id').eq('email', u.email).single();
      if (!existingUser) {
        const { error } = await admin.from('users').insert({
          email: u.email,
          full_name: u.full_name,
          role: u.role,
          org_id: u.org_id,
          password_hash: defaultPassword,
          totp_enabled: false,
          is_active: true,
          // Seed users are treated as pre-onboarded (they existed before this flow).
          // must_change_password defaults to FALSE per migration back-fill.
        });
        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true, message: 'Database successfully seeded with base entities and users.' });

  } catch (error: any) {
    console.error("Seeding failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
