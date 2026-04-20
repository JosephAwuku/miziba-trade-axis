export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';
import { getFDPSignedUrl } from '@/lib/supabase/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tradeId } = await params;
    const auth = await getAuthenticatedUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = supabaseAdmin;
    const { data: fdp, error: fdpError } = await admin
      .from('finance_data_packages')
      .select('pdf_s3_key')
      .eq('trade_id', tradeId)
      .eq('is_current', true)
      .single();

    if (fdpError || !fdp || !fdp.pdf_s3_key) {
      return NextResponse.json({ error: 'No current FDP PDF found' }, { status: 404 });
    }

    const { url, error: signError } = await getFDPSignedUrl(fdp.pdf_s3_key);
    
    if (signError) {
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
    }

    return NextResponse.json({ url });

  } catch (error) {
    console.error('FDP Download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
