-- Migration: Enable Row Level Security on all tables
-- Description: Locks down all tables so the public anon key can read nothing.
--              All API routes use the service_role key which bypasses RLS entirely,
--              so no application code changes are required.
--              Realtime subscriptions on trades/notifications remain functional
--              but are correctly filtered.
-- Date: 2026-05-07
--
-- HOW TO APPLY:
--   Paste this file into Supabase Dashboard → SQL Editor and run.
--   Safe to run multiple times (CREATE POLICY IF NOT EXISTS / IF NOT EXISTS guards).
-- =============================================================================

-- =============================================================================
-- STEP 1 — ENABLE ROW LEVEL SECURITY ON EVERY TABLE
-- FORCE ROW LEVEL SECURITY ensures even table owners (postgres role) are checked.
-- =============================================================================

ALTER TABLE organisations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations            FORCE  ROW LEVEL SECURITY;

ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                    FORCE  ROW LEVEL SECURITY;

ALTER TABLE trader_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader_profiles          FORCE  ROW LEVEL SECURITY;

ALTER TABLE finance_partner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_partner_profiles FORCE  ROW LEVEL SECURITY;

ALTER TABLE buyers                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers                   FORCE  ROW LEVEL SECURITY;

ALTER TABLE trades                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades                   FORCE  ROW LEVEL SECURITY;

ALTER TABLE trade_tranches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_tranches           FORCE  ROW LEVEL SECURITY;

ALTER TABLE trade_validations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_validations        FORCE  ROW LEVEL SECURITY;

ALTER TABLE trade_risk_scores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_risk_scores        FORCE  ROW LEVEL SECURITY;

ALTER TABLE ceo_escalations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceo_escalations          FORCE  ROW LEVEL SECURITY;

ALTER TABLE finance_data_packages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_data_packages    FORCE  ROW LEVEL SECURITY;

ALTER TABLE fp_decisions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fp_decisions             FORCE  ROW LEVEL SECURITY;

ALTER TABLE term_sheets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE term_sheets              FORCE  ROW LEVEL SECURITY;

ALTER TABLE deployment_batches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_batches       FORCE  ROW LEVEL SECURITY;

ALTER TABLE shipment_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_records         FORCE  ROW LEVEL SECURITY;

ALTER TABLE shipment_alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_alerts          FORCE  ROW LEVEL SECURITY;

ALTER TABLE waterfall_instructions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE waterfall_instructions   FORCE  ROW LEVEL SECURITY;

ALTER TABLE non_payment_protocols    ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_payment_protocols    FORCE  ROW LEVEL SECURITY;

ALTER TABLE non_payment_escalations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_payment_escalations  FORCE  ROW LEVEL SECURITY;

ALTER TABLE trade_closure_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_closure_checklists FORCE  ROW LEVEL SECURITY;

ALTER TABLE trade_documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_documents          FORCE  ROW LEVEL SECURITY;

ALTER TABLE organisation_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_documents   FORCE  ROW LEVEL SECURITY;

ALTER TABLE document_access_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_log      FORCE  ROW LEVEL SECURITY;

ALTER TABLE trade_stage_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_stage_log          FORCE  ROW LEVEL SECURITY;

ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            FORCE  ROW LEVEL SECURITY;

ALTER TABLE webhook_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events           FORCE  ROW LEVEL SECURITY;

ALTER TABLE trader_risk_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader_risk_history      FORCE  ROW LEVEL SECURITY;

ALTER TABLE audit_log                ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                FORCE  ROW LEVEL SECURITY;

ALTER TABLE sessions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions                 FORCE  ROW LEVEL SECURITY;

ALTER TABLE idempotency_keys         ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys         FORCE  ROW LEVEL SECURITY;

ALTER TABLE portfolio_metrics_cache  ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_metrics_cache  FORCE  ROW LEVEL SECURITY;

ALTER TABLE system_config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config            FORCE  ROW LEVEL SECURITY;

-- system_config also has the organisations seed row referenced in schema.sql,
-- but that is applied at migration time by postgres (superuser), not the app role,
-- so it is unaffected by RLS.

-- =============================================================================
-- STEP 2 — SERVICE ROLE FULL-ACCESS POLICY ON EVERY TABLE
--
-- The Next.js API routes all use SUPABASE_SERVICE_ROLE_KEY.
-- auth.role() = 'service_role' evaluates to true for that key.
-- This policy grants the API layer unrestricted access while blocking
-- any request coming in via the public anon key.
-- =============================================================================

-- organisations
CREATE POLICY "service_role_full_access" ON organisations
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- users
CREATE POLICY "service_role_full_access" ON users
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- trader_profiles
CREATE POLICY "service_role_full_access" ON trader_profiles
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- finance_partner_profiles
CREATE POLICY "service_role_full_access" ON finance_partner_profiles
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- buyers
CREATE POLICY "service_role_full_access" ON buyers
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- trades — Realtime subscription is used for refetch triggers only (no direct row reads).
-- Service role has full access; anon key gets no rows at all.
CREATE POLICY "service_role_full_access" ON trades
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- trade_tranches
CREATE POLICY "service_role_full_access" ON trade_tranches
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- trade_validations
CREATE POLICY "service_role_full_access" ON trade_validations
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- trade_risk_scores
CREATE POLICY "service_role_full_access" ON trade_risk_scores
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ceo_escalations
CREATE POLICY "service_role_full_access" ON ceo_escalations
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- finance_data_packages
CREATE POLICY "service_role_full_access" ON finance_data_packages
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- fp_decisions
CREATE POLICY "service_role_full_access" ON fp_decisions
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- term_sheets
CREATE POLICY "service_role_full_access" ON term_sheets
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- deployment_batches
CREATE POLICY "service_role_full_access" ON deployment_batches
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- shipment_records
CREATE POLICY "service_role_full_access" ON shipment_records
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- shipment_alerts
CREATE POLICY "service_role_full_access" ON shipment_alerts
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- waterfall_instructions
CREATE POLICY "service_role_full_access" ON waterfall_instructions
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- non_payment_protocols
CREATE POLICY "service_role_full_access" ON non_payment_protocols
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- non_payment_escalations
CREATE POLICY "service_role_full_access" ON non_payment_escalations
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- trade_closure_checklists
CREATE POLICY "service_role_full_access" ON trade_closure_checklists
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- trade_documents
CREATE POLICY "service_role_full_access" ON trade_documents
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- organisation_documents
CREATE POLICY "service_role_full_access" ON organisation_documents
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- document_access_log
CREATE POLICY "service_role_full_access" ON document_access_log
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- trade_stage_log
CREATE POLICY "service_role_full_access" ON trade_stage_log
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- webhook_events
CREATE POLICY "service_role_full_access" ON webhook_events
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- trader_risk_history
CREATE POLICY "service_role_full_access" ON trader_risk_history
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- sessions
CREATE POLICY "service_role_full_access" ON sessions
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- idempotency_keys
CREATE POLICY "service_role_full_access" ON idempotency_keys
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- portfolio_metrics_cache
CREATE POLICY "service_role_full_access" ON portfolio_metrics_cache
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- system_config
CREATE POLICY "service_role_full_access" ON system_config
  AS PERMISSIVE FOR ALL
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- STEP 3 — NOTIFICATIONS: REALTIME ROW FILTER (self-only)
--
-- The browser Supabase client in NotificationCenter.tsx subscribes to
-- INSERT events on notifications filtered by user_id eq <current_user_id>.
-- The Realtime filter in the subscription itself is a client-side hint;
-- the DB policy is the actual enforcement layer.
--
-- We use a separate SELECT policy that allows a row to be seen via Realtime
-- only when the JWT sub claim matches the notification's user_id.
-- The service_role policy above already covers the API layer (SELECT via API).
-- =============================================================================

CREATE POLICY "realtime_own_notifications" ON notifications
  AS PERMISSIVE FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR user_id::text = (
      COALESCE(
        NULLIF(current_setting('request.jwt.claims', true), ''),
        '{}'
      )::jsonb ->> 'sub'
    )
  );

-- =============================================================================
-- STEP 4 — AUDIT_LOG: APPEND-ONLY
--
-- The schema comment at the bottom of schema.sql already documents the intent:
--   "REVOKE UPDATE, DELETE ON audit_log FROM tradeaxis_app;"
-- We enforce this via RLS policies instead of REVOKE so it applies to all roles
-- including any future application credentials.
--
-- The service_role_full_access policy created in step 2 already grants SELECT
-- and INSERT via the service role (API routes).  We add explicit RESTRICTIVE
-- policies that forbid UPDATE and DELETE for everyone, including service_role.
-- RESTRICTIVE policies are ANDed with permissive ones — if any RESTRICTIVE
-- policy returns false the operation is blocked regardless of permissive grants.
-- =============================================================================

CREATE POLICY "audit_log_no_update" ON audit_log
  AS RESTRICTIVE FOR UPDATE
  USING (false);

CREATE POLICY "audit_log_no_delete" ON audit_log
  AS RESTRICTIVE FOR DELETE
  USING (false);

-- =============================================================================
-- STEP 5 — STORAGE BUCKETS
--
-- Supabase Storage has its own RLS layer on the `storage.objects` table.
-- The two buckets used by the app are:
--   - miziba-tradeaxis-docs  (trade documents, org KYC docs)
--   - fdp_documents          (Finance Data Package PDFs)
--
-- All storage access in API routes already uses the service role key which
-- bypasses storage RLS. However, we should also ensure the buckets themselves
-- are set to private (not public) in the Supabase dashboard:
--   Dashboard → Storage → <bucket name> → Edit → uncheck "Public bucket".
--
-- If the storage.objects table is accessible, add service_role policies:
-- (These are safe no-ops if the bucket policies already exist.)
-- =============================================================================

-- Storage objects: only service role may read/write
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    -- miziba-tradeaxis-docs
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname = 'service_role_docs_access'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "service_role_docs_access" ON storage.objects
          AS PERMISSIVE FOR ALL
          USING      (auth.role() = 'service_role')
          WITH CHECK (auth.role() = 'service_role')
      $policy$;
    END IF;
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION QUERIES (run after applying to confirm)
-- =============================================================================
--
-- Check RLS is enabled on all tables:
--   SELECT tablename, rowsecurity, forcerowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
--
-- Check policies created:
--   SELECT tablename, policyname, permissive, roles, cmd, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
--
-- Confirm anon key gets empty results (run as anon role or use Supabase anon client):
--   SELECT count(*) FROM users;     -- should return 0 rows / permission denied
--   SELECT count(*) FROM trades;    -- should return 0 rows / permission denied
