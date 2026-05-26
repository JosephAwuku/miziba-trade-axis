import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { getDocumentsBucket } from '@/lib/supabase/buckets';
import { isKycApproverRole } from '@/lib/kyc-approvers';

export const dynamic = 'force-dynamic';

// GET — short-lived signed URL to download a trader KYC document from storage
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: orgId, docId } = await params;

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const auth = await getAuthenticatedUser(token);
    if (!auth || !isKycApproverRole(auth.profile.role)) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'You are not allowed to download trader KYC documents.' }, { status: 403 });
    }

    const admin = supabaseAdmin;

    const { data: org, error: orgErr } = await admin
      .from('organisations')
      .select('id, type')
      .eq('id', orgId)
      .single();

    if (orgErr || !org || org.type !== 'trader') {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Trader organisation not found.' }, { status: 404 });
    }

    const { data: doc, error: docErr } = await admin
      .from('organisation_documents')
      .select('id, org_id, storage_path, name')
      .eq('id', docId)
      .eq('org_id', orgId)
      .single();

    if (docErr || !doc?.storage_path) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Document not found.' }, { status: 404 });
    }

    const { data: signed, error: signErr } = await admin.storage
      .from(getDocumentsBucket())
      .createSignedUrl(doc.storage_path, 3600);

    if (signErr || !signed?.signedUrl) {
      console.error('Signed URL error:', signErr);
      return NextResponse.json({ error: 'STORAGE_ERROR', message: signErr?.message || 'Could not create download link.' }, { status: 500 });
    }

    return NextResponse.json({
      url: signed.signedUrl,
      filename: doc.name,
    });
  } catch (error) {
    console.error('GET KYC document signed URL error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
