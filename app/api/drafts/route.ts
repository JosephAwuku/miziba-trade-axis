import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

function bearerToken(request: NextRequest): string | undefined {
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(bearerToken(request));
    if (!auth || auth.profile.role !== 'trader') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: drafts, error } = await supabaseAdmin
      .from('draft_trades')
      .select('*')
      .eq('trader_org_id', auth.profile.org_id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ drafts: drafts || [] });
  } catch (error) {
    console.error('GET /api/drafts error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(bearerToken(request));
    if (!auth || auth.profile.role !== 'trader') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json();
    const { draft_data, title, last_edited_step } = body;

    if (!draft_data || typeof draft_data !== 'object') {
      return NextResponse.json({ error: 'Invalid draft data' }, { status: 400 });
    }

    const { data: draft, error } = await supabaseAdmin
      .from('draft_trades')
      .insert({
        trader_org_id: auth.profile.org_id,
        created_by_user_id: auth.profile.id,
        draft_data,
        title: title || null,
        last_edited_step: last_edited_step || 1,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, draft }, { status: 201 });
  } catch (error) {
    console.error('POST /api/drafts error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
