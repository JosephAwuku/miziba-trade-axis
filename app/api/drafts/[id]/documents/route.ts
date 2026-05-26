export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { getDocumentsBucket } from '@/lib/supabase/buckets';
import type { TradeDocumentRecord } from '@/lib/trade-documents';

function bearerToken(request: NextRequest): string | undefined {
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
}

async function loadDraft(draftId: string, orgId: string) {
  const { data: draft, error } = await supabaseAdmin
    .from('draft_trades')
    .select('*')
    .eq('id', draftId)
    .eq('trader_org_id', orgId)
    .single();

  if (error || !draft) return null;
  return draft;
}

async function attachSignedUrls(documents: TradeDocumentRecord[]) {
  const bucket = getDocumentsBucket();
  return Promise.all(
    documents.map(async (doc) => {
      if (!doc.storage_path) return doc;
      const { data } = await (supabaseAdmin.storage.from(bucket) as any).createSignedUrl(doc.storage_path, 3600);
      return { ...doc, url: data?.signedUrl || null };
    })
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: draftId } = await params;
    const auth = await getAuthenticatedUser(bearerToken(request));
    if (!auth || auth.profile.role !== 'trader') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const draft = await loadDraft(draftId, auth.profile.org_id);
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const draftData = (draft.draft_data || {}) as Record<string, unknown>;
    const documents = (draftData.trade_documents as TradeDocumentRecord[]) || [];
    const withUrls = await attachSignedUrls(documents);

    return NextResponse.json({ draft_id: draftId, documents: withUrls });
  } catch (error) {
    console.error('GET /api/drafts/[id]/documents error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: draftId } = await params;
    const auth = await getAuthenticatedUser(bearerToken(request));
    if (!auth || auth.profile.role !== 'trader') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const draft = await loadDraft(draftId, auth.profile.org_id);
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const docType = formData.get('doc_type') ? String(formData.get('doc_type')) : '';
    const displayName = formData.get('name') ? String(formData.get('name')) : '';

    if (!file || !docType) {
      return NextResponse.json({ error: 'INVALID_DATA', message: 'file and doc_type are required' }, { status: 400 });
    }

    const safeName = file.name.replace(/\s+/g, '_');
    const storagePath = `drafts/${draftId}/${docType}_${Date.now()}_${safeName}`;

    const { error: uploadError } = await (supabaseAdmin.storage.from(getDocumentsBucket()) as any).upload(
      storagePath,
      file,
      { upsert: true, contentType: file.type || 'application/octet-stream' }
    );

    if (uploadError) {
      return NextResponse.json({ error: 'UPLOAD_FAILED', message: uploadError.message }, { status: 500 });
    }

    const newDoc: TradeDocumentRecord = {
      doc_type: docType,
      name: displayName || file.name,
      storage_path: storagePath,
      status: 'UPLOADED',
      uploaded_at: new Date().toISOString(),
      size_bytes: file.size || 0,
    };

    const draftData = (draft.draft_data || {}) as Record<string, unknown>;
    const existing = ((draftData.trade_documents as TradeDocumentRecord[]) || []).filter(
      (d) => d.doc_type !== docType
    );
    const trade_documents = [...existing, newDoc];

    const { error: updateError } = await supabaseAdmin
      .from('draft_trades')
      .update({
        draft_data: { ...draftData, trade_documents },
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)
      .eq('trader_org_id', auth.profile.org_id);

    if (updateError) {
      return NextResponse.json({ error: 'DATABASE_ERROR' }, { status: 500 });
    }

    const [withUrl] = await attachSignedUrls([newDoc]);
    return NextResponse.json(withUrl);
  } catch (error) {
    console.error('POST /api/drafts/[id]/documents error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
