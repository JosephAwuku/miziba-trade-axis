import { createBrowserClient } from '@supabase/ssr';
import { Database } from '../database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Singleton for browser use to avoid redundant client creation
export const supabase = typeof window !== 'undefined' ? createClient() : null;
