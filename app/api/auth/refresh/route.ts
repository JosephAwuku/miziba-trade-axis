import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSessionExpiryMinutes, sessionExpiresAtMs } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// POST /api/auth/refresh
// Rotates a still-valid session token into a fresh token.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
    } catch (err: any) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: err?.message || 'Invalid token' }, { status: 401 });
    }

    const userId: string | undefined = decoded?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, is_active')
      .eq('id', userId)
      .single();

    if (error || !user || !(user as any).is_active) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const sessionMinutes = getSessionExpiryMinutes((user as any).role);
    const newToken = jwt.sign(
      { user: { id: (user as any).id, email: (user as any).email, role: (user as any).role } },
      JWT_SECRET,
      { expiresIn: `${sessionMinutes}m` }
    );

    return NextResponse.json({
      token: newToken,
      expires_at: new Date(sessionExpiresAtMs((user as any).role)).toISOString(),
    });
  } catch (error) {
    console.error('POST /api/auth/refresh error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
