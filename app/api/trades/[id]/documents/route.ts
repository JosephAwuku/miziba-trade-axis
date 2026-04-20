export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

// GET /api/trades/[id]/documents — List documents for a trade
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tradeId } = await params;
    const auth = await getAuthenticatedUser();

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const admin = await supabaseAdmin();

    // Fetch documents associated with this trade
    const { data: documents, error } = await admin
      .from('trade_documents')
      .select('*')
      .eq('trade_id', tradeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Documents fetch error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    return NextResponse.json(documents || []);
  } catch (error) {
    console.error('GET /api/trades/[id]/documents error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// POST /api/trades/[id]/documents — Upload metadata for a document (placeholder for storage integration)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tradeId } = await params;
    const auth = await getAuthenticatedUser();

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const profile = auth.profile as any;
    const body = await request.json();
    const { name, type, url, size } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'INVALID_DATA' }, { status: 400 });
    }

    const admin = await supabaseAdmin();

    const { data: document, error } = await (admin
      .from('trade_documents') as any)
      .insert({
        trade_id: tradeId,
        name,
        doc_type: type, // doc_type in schema
        s3_key: url || `docs/${tradeId}/${Date.now()}-${name}`, // s3_key in schema
        size_bytes: size || 0,
        uploaded_by: profile.id,
        status: 'UPLOADED' // enum value in schema
      })
      .select()
      .single();

    if (error) {
      console.error('Document upload recording error:', error);
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error('POST /api/trades/[id]/documents error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}