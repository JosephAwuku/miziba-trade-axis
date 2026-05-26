/**
 * Supabase Storage bucket names.
 *
 * Set in `.env.local` (must match the bucket **name** in Supabase → Storage exactly):
 *
 *   SUPABASE_STORAGE_BUCKET=KYC BUCKET
 *
 * If your bucket id uses hyphens instead (e.g. `kyc-bucket`), use that exact string.
 */

function trimBucket(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t || undefined;
}

/** Primary bucket: trader KYC, trade documents, organisation docs */
export function getDocumentsBucket(): string {
  return (
    trimBucket(process.env.SUPABASE_STORAGE_BUCKET) ??
    trimBucket(process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET) ??
    'KYC BUCKET'
  );
}

/** FDP PDFs — uses same bucket with `fdp/` prefix unless overridden */
export function getFdpBucket(): string {
  return trimBucket(process.env.SUPABASE_FDP_BUCKET) ?? getDocumentsBucket();
}
