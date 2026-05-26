export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { serializeAggregatorRow, CREDIT_RATING_TO_SCORE } from '@/lib/aggregator-serialize';

// GET /api/portfolio/aggregators — Get aggregator creditworthiness database
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const typedUser = auth.profile as any;
    if (!['deal_officer', 'ceo', 'ops_admin'].includes(typedUser.role)) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Only authorized staff can access aggregators.' }, { status: 403 });
    }

    const admin = supabaseAdmin;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    
    // Fetch all aggregators with their trade performance history
    let query = admin.from('aggregators').select('*');

    if (search) {
      query = query.or(`name.ilike.%${search}%,country.ilike.%${search}%`);
    }

    const { data: aggregators, error } = await query;

    if (error) {
      console.error('[API] Aggregators fetch error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR', details: error.message }, { status: 500 });
    }

    console.log(`[API] Successfully fetched ${aggregators?.length || 0} aggregators`);


    const processedAggregators = (aggregators as any[] || []).map((a) => serializeAggregatorRow(a as Record<string, unknown>));

    return NextResponse.json(processedAggregators);
  } catch (error) {
    console.error('GET /api/portfolio/aggregators error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// POST /api/portfolio/aggregators — Add new aggregator
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const typedUser = auth.profile as any;
    if (!['deal_officer', 'ceo', 'ops_admin'].includes(typedUser.role)) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Only authorized staff can add aggregators.' }, { status: 403 });
    }

    const data = await request.json();
    const admin = supabaseAdmin;

    const { data: newAggregator, error } = await (admin
      .from('aggregators') as any)
      .insert({
        name: data.name,
        country: data.country,
        registration_no: data.registrationNumber || null,
        creditworthiness_score: CREDIT_RATING_TO_SCORE[data.credit_rating] || 70,
        notes: data.notes || '',
        sanctions_clear: data.sanctions_clear ?? false,
        sanctions_checked_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Aggregator creation error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, aggregator: newAggregator });
  } catch (error) {
    console.error('POST /api/portfolio/aggregators error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// DELETE /api/portfolio/aggregators — Delete an aggregator
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const typedUser = auth.profile as any;
    if (!['deal_officer', 'ceo', 'ops_admin'].includes(typedUser.role)) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Only authorized staff can manage aggregators.' }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'MISSING_ID', message: 'Aggregator ID is required.' }, { status: 400 });
    }

    const admin = supabaseAdmin;

    const { error } = await admin
      .from('aggregators')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Aggregator deletion error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/portfolio/aggregators error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
