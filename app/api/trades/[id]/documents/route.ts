export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { getDocumentsBucket } from '@/lib/supabase/buckets';

// GET /api/trades/[id]/documents — List documents for a trade
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tradeId } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const auth = await getAuthenticatedUser(token);

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const admin = supabaseAdmin;

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

    const normalizedDocuments = await Promise.all(
      (documents || []).map(async (doc: any) => {
        let url: string | null = null;

        if (doc.s3_key) {
          const { data: signedUrlData } = await (admin.storage
            .from(getDocumentsBucket()) as any)
            .createSignedUrl(doc.s3_key, 3600);
          url = signedUrlData?.signedUrl || null;
        }

        return {
          id: doc.id,
          name: doc.name,
          type: doc.doc_type,
          url,
          size_bytes: doc.size_bytes || 0,
          status: String(doc.status || 'UPLOADED').toLowerCase(),
          created_at: doc.created_at,
        };
      })
    );

    return NextResponse.json({
      trade_id: tradeId,
      documents: normalizedDocuments,
    });
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
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const auth = await getAuthenticatedUser(token);

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const profile = auth.profile as any;
    const contentType = request.headers.get('content-type') || '';

    let name = '';
    let type = '';
    let size = 0;
    let s3Key: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'INVALID_DATA', message: 'file is required' }, { status: 400 });
      }

      const docTypeField = formData.get('doc_type');
      const displayName = formData.get('name');
      name = displayName ? String(displayName) : file.name;
      type = docTypeField ? String(docTypeField) : file.type || 'application/octet-stream';
      size = file.size || 0;

      const safeName = file.name.replace(/\s+/g, '_');
      const filePath = `trades/${tradeId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await (supabaseAdmin.storage
        .from(getDocumentsBucket()) as any)
        .upload(filePath, file, {
          upsert: true,
          contentType: type,
        });

      if (uploadError) {
        return NextResponse.json({ error: 'UPLOAD_FAILED', message: uploadError.message }, { status: 500 });
      }

      s3Key = filePath;
    } else {
      const body = await request.json();
      name = body?.name;
      type = body?.type;
      size = body?.size || 0;
      s3Key = body?.url || null;
    }

    if (!name || !type) {
      return NextResponse.json({ error: 'INVALID_DATA' }, { status: 400 });
    }

    const admin = supabaseAdmin;

    const { data: document, error } = await (admin
      .from('trade_documents') as any)
      .insert({
        trade_id: tradeId,
        name,
        doc_type: type, // doc_type in schema
        s3_key: s3Key || `docs/${tradeId}/${Date.now()}-${name}`, // s3_key in schema
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