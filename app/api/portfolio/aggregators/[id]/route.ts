export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { serializeAggregatorRow, CREDIT_RATING_TO_SCORE } from '@/lib/aggregator-serialize';

const allowedRoles = ['deal_officer', 'ceo', 'ops_admin'] as const;

async function assertAggregatorAccess(token: string | undefined) {
  const auth = await getAuthenticatedUser(token);
  if (!auth) {
    return { error: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }) } as const;
  }
  const role = (auth.profile as { role?: string }).role;
  if (!role || !allowedRoles.includes(role as (typeof allowedRoles)[number])) {
    return {
      error: NextResponse.json({ error: 'FORBIDDEN', message: 'Only authorized staff can manage aggregators.' }, { status: 403 }),
    } as const;
  }
  return { auth } as const;
}

// GET /api/portfolio/aggregators/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.startsWith('Bearer ')
      ? request.headers.get('authorization')!.slice(7)
      : undefined;
    const gate = await assertAggregatorAccess(token);
    if ('error' in gate) return gate.error;

    const { id } = await params;
    const admin = supabaseAdmin;

    const { data: row, error } = await admin
      .from('aggregators')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[API] Aggregator fetch error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR', details: error.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const aggregator = serializeAggregatorRow(row as Record<string, unknown>);
    return NextResponse.json({ data: aggregator });
  } catch (e) {
    console.error('GET /api/portfolio/aggregators/[id] error:', e);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// PATCH /api/portfolio/aggregators/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.startsWith('Bearer ')
      ? request.headers.get('authorization')!.slice(7)
      : undefined;
    const gate = await assertAggregatorAccess(token);
    if ('error' in gate) return gate.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const admin = supabaseAdmin;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.country === 'string' && body.country.trim()) updates.country = body.country.trim();
    if (body.registration_no !== undefined) {
      updates.registration_no =
        body.registration_no === null || body.registration_no === ''
          ? null
          : String(body.registration_no).trim();
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes === null ? null : String(body.notes);
    }
    if (typeof body.sanctions_clear === 'boolean') {
      updates.sanctions_clear = body.sanctions_clear;
      updates.sanctions_checked_at = new Date().toISOString();
    }
    if (body.credit_rating !== undefined && typeof body.credit_rating === 'string') {
      const s = CREDIT_RATING_TO_SCORE[body.credit_rating] ?? 70;
      updates.creditworthiness_score = s;
    } else if (body.creditworthiness_score !== undefined && typeof body.creditworthiness_score === 'number') {
      updates.creditworthiness_score = Math.max(0, Math.min(100, body.creditworthiness_score));
    }

    const { data: updated, error } = await admin
      .from('aggregators')
      .update(updates as never)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Aggregator PATCH error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR', message: error.message }, { status: 500 });
    }

    const aggregator = serializeAggregatorRow(updated as Record<string, unknown>);
    return NextResponse.json({ success: true, data: aggregator });
  } catch (e) {
    console.error('PATCH /api/portfolio/aggregators/[id] error:', e);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
