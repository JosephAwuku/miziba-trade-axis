/**
 * Supabase environment variables.
 * Next.js loads `.env`, `.env.local`, `.env.development.local` into `process.env` automatically.
 * We also call `loadEnvConfig` from `next.config.ts` so vars are available early.
 */

function trim(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t || undefined;
}

/** Project URL: prefer public name used in browser; allow server-only alias. */
export function getSupabaseUrl(): string | undefined {
  return trim(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? trim(process.env.SUPABASE_URL);
}

/** Anon / publishable key. On the server and in middleware, non-public aliases work too. */
export function getSupabaseAnonKey(): string | undefined {
  return (
    trim(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? trim(process.env.SUPABASE_ANON_KEY)
  );
}

/**
 * Browser client: only `NEXT_PUBLIC_*` vars are bundled; do not rely on `SUPABASE_ANON_KEY` in the client.
 */
export function getSupabaseBrowserConfig(): { url: string; anonKey: string } | null {
  const url = trim(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = trim(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return trim(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
