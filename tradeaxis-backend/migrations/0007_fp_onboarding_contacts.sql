-- Migration: Add portal contact columns to finance_partner_profiles
-- Description: Stores the designated reviewer and approver nominated during
--              Step 3 of the finance partner onboarding wizard.
-- Date: 2026-05-08

ALTER TABLE finance_partner_profiles
  ADD COLUMN IF NOT EXISTS reviewer_name TEXT,
  ADD COLUMN IF NOT EXISTS approver_name TEXT;

COMMENT ON COLUMN finance_partner_profiles.reviewer_name IS 'Designated reviewer nominated during onboarding Step 3';
COMMENT ON COLUMN finance_partner_profiles.approver_name IS 'Designated approver nominated during onboarding Step 3';
