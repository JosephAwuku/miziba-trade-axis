import { createBrowserClient } from '@supabase/ssr';
import { Database } from '../database.types';
import { getSupabaseBrowserConfig } from './env';

export function createClient() {
  const cfg = getSupabaseBrowserConfig();
  if (!cfg) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local and restart the dev server.'
    );
  }
  return createBrowserClient<Database>(cfg.url, cfg.anonKey);
}

// Singleton for browser use to avoid redundant client creation
export const supabase = typeof window !== 'undefined' ? createClient() : null;
