export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthenticatedUser } from '@/lib/supabase';

// GET /api/auth/me
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    
    // getAuthenticatedUser now handles both token and cookies
    const auth = await getAuthenticatedUser(token);

    if (!auth) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { profile } = auth;

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      org_id: profile.org_id,
      org_name: profile.org_name || '',
      totp_enabled: profile.totp_enabled,
    });
  } catch (error) {
    console.error('GET /api/auth/me error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}