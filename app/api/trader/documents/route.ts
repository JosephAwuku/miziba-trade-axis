import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { getDocumentsBucket } from '@/lib/supabase/buckets';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    const auth = await getAuthenticatedUser(token);
    if (!auth || auth.profile.role !== 'trader') {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Only traders can upload KYC documents.' }, { status: 403 });
    }

    const { profile } = auth;
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const docType = formData.get('docType') as string;

    if (!file || !docType) {
      return NextResponse.json({ error: 'MISSING_DATA', message: 'File and Document Type are required.' }, { status: 400 });
    }

    const admin = supabaseAdmin;

    // 1. Upload to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.org_id}/${docType.replace(/\s+/g, '_')}_${Date.now()}.${fileExt}`;
    const filePath = `kyc/${fileName}`;

    const { error: uploadError } = await admin.storage
      .from(getDocumentsBucket())
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'UPLOAD_FAILED', message: uploadError.message }, { status: 500 });
    }

    // 2. Record metadata
    const { data: docRow, error: dbError } = await admin
      .from('organisation_documents')
      .upsert({
        org_id: profile.org_id,
        doc_type: docType,
        name: file.name,
        storage_path: filePath,
        status: 'UPLOADED',
        uploaded_by: profile.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'org_id, doc_type' })
      .select('id')
      .single();

    if (dbError) {
      console.error('Organisation document metadata write failed:', dbError);
      return NextResponse.json({ error: 'DB_WRITE_FAILED', message: dbError.message }, { status: 500 });
    }

    const { data: orgRow } = await admin.from('organisations').select('kyc_status').eq('id', profile.org_id).single();
    if (orgRow?.kyc_status === 'REJECTED') {
      await admin
        .from('organisations')
        .update({ kyc_status: 'PENDING', updated_at: new Date().toISOString() })
        .eq('id', profile.org_id);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Document uploaded successfully.',
      path: filePath,
      id: docRow?.id,
    });

  } catch (error) {
    console.error('POST /api/trader/documents error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Something went wrong.' }, { status: 500 });
  }
}
