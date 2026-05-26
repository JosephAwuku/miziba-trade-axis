export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { serializeBuyerRow, CREDIT_RATING_TO_SCORE } from '@/lib/buyer-serialize';

// GET /api/portfolio/buyers — Get buyer creditworthiness database
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const admin = supabaseAdmin;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    
    // Fetch all buyers with their trade performance history
    let query = admin
      .from('buyers')
      .select(`
        *,
        trades (
          id,
          stage,
          contract_value_usd,
          settled_at
        )
      `);

    if (search) {
      query = query.or(`name.ilike.%${search}%,country.ilike.%${search}%`);
    }

    const { data: buyers, error } = await query;

    if (error) {
      console.error('[API] Buyers fetch error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR', details: error.message }, { status: 500 });
    }

    console.log(`[API] Successfully fetched ${buyers?.length || 0} buyers`);


    const processedBuyers = (buyers as any[] || []).map((b) => serializeBuyerRow(b as Record<string, unknown>));

    return NextResponse.json(processedBuyers);
  } catch (error) {
    console.error('GET /api/portfolio/buyers error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// POST /api/portfolio/buyers — Add new buyer
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const typedUser = auth.profile as any;
    if (!['deal_officer', 'ceo', 'cfo', 'ops_admin'].includes(typedUser.role)) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Only internal staff can add buyers.' }, { status: 403 });
    }

    const data = await request.json();
    const admin = supabaseAdmin;

    const { data: newBuyer, error } = await (admin
      .from('buyers') as any)
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
      console.error('Buyer creation error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, buyer: newBuyer });
  } catch (error) {
    console.error('POST /api/portfolio/buyers error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// DELETE /api/portfolio/buyers — Delete a buyer
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const typedUser = auth.profile as any;
    if (!['deal_officer', 'ceo', 'cfo', 'ops_admin'].includes(typedUser.role)) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Only internal staff can manage buyers.' }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'MISSING_ID', message: 'Buyer ID is required.' }, { status: 400 });
    }

    const admin = supabaseAdmin;

    const { error } = await admin
      .from('buyers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Buyer deletion error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/portfolio/buyers error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
