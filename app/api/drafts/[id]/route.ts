import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

function bearerToken(request: NextRequest): string | undefined {
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedUser(bearerToken(request));
    if (!auth || auth.profile.role !== 'trader') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: draft, error } = await supabaseAdmin
      .from('draft_trades')
      .select('*')
      .eq('id', id)
      .eq('trader_org_id', auth.profile.org_id)
      .single();

    if (error || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('GET /api/drafts/[id] error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedUser(bearerToken(request));
    if (!auth || auth.profile.role !== 'trader') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json();
    const { draft_data, title, last_edited_step } = body;

    const updates: Record<string, any> = {};
    if (draft_data) updates.draft_data = draft_data;
    if (title !== undefined) updates.title = title;
    if (last_edited_step !== undefined) updates.last_edited_step = last_edited_step;

    const { data: draft, error } = await supabaseAdmin
      .from('draft_trades')
      .update(updates)
      .eq('id', id)
      .eq('trader_org_id', auth.profile.org_id)
      .select()
      .single();

    if (error || !draft) {
      return NextResponse.json({ error: 'Draft not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, draft });
  } catch (error) {
    console.error('PATCH /api/drafts/[id] error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedUser(bearerToken(request));
    if (!auth || auth.profile.role !== 'trader') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('draft_trades')
      .delete()
      .eq('id', id)
      .eq('trader_org_id', auth.profile.org_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/drafts/[id] error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
