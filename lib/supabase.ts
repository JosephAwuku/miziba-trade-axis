/**
 * Supabase client configuration for TradeAxis
 */

import { createClient as createBrowserClient } from './supabase/client';
import { createClient as createServerClient, createAdminClient } from './supabase/server';
import { Database } from './database.types';

// Backward compatibility exports
export const supabase = typeof window !== 'undefined' ? createBrowserClient() : null;

// Helper to get user from session in API routes
export async function getUserFromSession(sessionToken?: string) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser(sessionToken);
  if (error) throw error;
  return user;
}

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Helper to get user profile with role
export async function getUserProfile(userId: string) {
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from('users')
    .select(`
      *,
      organisations:org_id (
        name
      )
    `)
    .eq('id', userId)
    .single();

  if (error) {
    console.error('getUserProfile error:', error);
    return null;
  }
  return data as any;
}

export async function getAuthenticatedUser(token?: string) {
  try {
    const supabaseAdmin = await createAdminClient();
    let userId: string | null = null;
    let authUser: any = null;

    if (token && token !== 'mock-dev-token') {
      try {
        // 1. Try custom JWT from our API
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded?.user?.id) {
          userId = decoded.user.id;
          authUser = decoded.user;
        }
      } catch (e) {
        // 2. Fallback to Supabase Auth token
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) {
          userId = user.id;
          authUser = user;
        }
      }
    } else if (token === 'mock-dev-token') {
      userId = '00000000-0000-0000-0000-000000000000'; 
    } else {
      // 3. Check for cookie-based session (App Router default)
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        authUser = user;
      }
    }

    if (!userId) return null;

    const profile = await getUserProfile(userId);
    if (!profile) return null;

    return {
      authUser: authUser || { id: userId },
      profile: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        org_id: profile.org_id,
        org_name: profile.organisations?.name || '',
        totp_enabled: profile.totp_enabled || false,
      },
    };
  } catch (err) {
    console.error('getAuthenticatedUser error:', err);
    return null;
  }
}

// Re-export admin client for specialized server-side tasks
export async function getSupabaseAdmin() {
  return await createAdminClient();
}

/**
 * Legacy admin client export for direct use in API routes
 */
import { createServerClient as createBaseClient } from '@supabase/ssr';
export const supabaseAdmin = typeof window === 'undefined' 
  ? createBaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )
  : null as any;