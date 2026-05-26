-- Optional storage policies for the documents bucket (run in Supabase SQL Editor).
-- Replace 'KYC BUCKET' if your bucket id differs (check Storage → bucket name).
--
-- Note: API uploads use the service role and bypass these policies.
-- Policies help if you later use the anon/authenticated client for direct uploads.

-- Example: allow authenticated users to read objects under their org folder (adjust as needed)
-- CREATE POLICY "authenticated_read_own_org"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (
--   bucket_id = 'KYC BUCKET'
--   AND (storage.foldername(name))[1] = 'kyc'
-- );

-- For production, prefer keeping uploads via Next.js API (service role) only.
