import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { getDocumentsBucket } from '@/lib/supabase/buckets';

export const dynamic = 'force-dynamic';

// GET — short-lived signed URL for a trader to preview their own KYC document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const auth = await getAuthenticatedUser(token);
    if (!auth || auth.profile.role !== 'trader') {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Only traders can preview their KYC documents.' }, { status: 403 });
    }

    const admin = supabaseAdmin;

    const { data: doc, error: docErr } = await admin
      .from('organisation_documents')
      .select('id, org_id, storage_path, name')
      .eq('id', docId)
      .eq('org_id', auth.profile.org_id)
      .single();

    if (docErr || !doc?.storage_path) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Document not found.' }, { status: 404 });
    }

    const { data: signed, error: signErr } = await admin.storage
      .from(getDocumentsBucket())
      .createSignedUrl(doc.storage_path, 3600);

    if (signErr || !signed?.signedUrl) {
      console.error('Signed URL error:', signErr);
      return NextResponse.json({ error: 'STORAGE_ERROR', message: signErr?.message || 'Could not create preview link.' }, { status: 500 });
    }

    return NextResponse.json({
      url: signed.signedUrl,
      filename: doc.name,
    });
  } catch (error) {
    console.error('GET /api/trader/documents/[docId] error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
