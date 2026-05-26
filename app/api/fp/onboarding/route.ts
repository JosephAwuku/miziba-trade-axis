export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

// GET /api/fp/onboarding
// Returns the authenticated finance partner's onboarding state.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const auth = await getAuthenticatedUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    if (auth.profile.role !== 'finance_partner') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('finance_partner_profiles')
      .select(
        'onboarding_step, onboarding_done, framework_signed, portal_active, ' +
        'reviewer_name, approver_name, bank_name, bank_swift, next_interaction'
      )
      .eq('org_id', auth.profile.org_id)
      .single();

    if (error) {
      console.error('GET /api/fp/onboarding error:', error);
      return NextResponse.json({ onboarding_step: 1, onboarding_done: false });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/fp/onboarding unexpected error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// POST /api/fp/onboarding
// Saves the data collected in a specific onboarding step and advances the step counter.
//
// Body shape per step:
//   Step 1: { step: 1 }                                              (acknowledgement only)
//   Step 2: { step: 2, framework_signed: true }                      (document acknowledged)
//   Step 3: { step: 3, reviewer_name: string, approver_name: string }
//   Step 4: { step: 4, bank_name: string, bank_swift: string }
//   Step 5: { step: 5 }                                              (briefing acknowledged)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const auth = await getAuthenticatedUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    if (auth.profile.role !== 'finance_partner') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json();
    const { step } = body as { step: number; [key: string]: any };

    if (!step || step < 1 || step > 5) {
      return NextResponse.json({ error: 'INVALID_STEP' }, { status: 400 });
    }

    const nextStep = step + 1;
    const isComplete = step === 5;

    const updates: Record<string, any> = {
      onboarding_step: nextStep,
      onboarding_done: isComplete,
      updated_at: new Date().toISOString(),
    };

    if (step === 2) {
      updates.framework_signed = true;
      updates.framework_signed_at = new Date().toISOString();
    }

    if (step === 3) {
      const { reviewer_name, approver_name } = body as { reviewer_name?: string; approver_name?: string };
      if (reviewer_name) updates.reviewer_name = reviewer_name.trim();
      if (approver_name) updates.approver_name = approver_name.trim();
      updates.portal_active = true;
    }

    if (step === 4) {
      const { bank_name, bank_swift } = body as { bank_name?: string; bank_swift?: string };
      if (!bank_name || !bank_swift) {
        return NextResponse.json(
          { error: 'MISSING_FIELDS', message: 'Bank name and SWIFT code are required.' },
          { status: 400 }
        );
      }
      updates.bank_name = bank_name.trim();
      updates.bank_swift = bank_swift.trim().toUpperCase();
    }

    const { error } = await supabaseAdmin
      .from('finance_partner_profiles')
      .update(updates)
      .eq('org_id', auth.profile.org_id);

    if (error) {
      console.error('POST /api/fp/onboarding update error:', error);
      return NextResponse.json({ error: 'UPDATE_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, onboarding_step: nextStep, onboarding_done: isComplete });
  } catch (err) {
    console.error('POST /api/fp/onboarding unexpected error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
