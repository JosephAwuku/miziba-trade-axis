-- Migration: User onboarding state fields
-- Description: Adds must_change_password, mfa_enrolled_at, and created_by to support
--              the self-service first-login flow (forced password reset → self-enrolled OTP).
-- Date: 2026-05-07

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by           UUID REFERENCES users(id) ON DELETE SET NULL;

-- Back-fill: existing accounts created before this migration are treated as fully onboarded.
UPDATE users
SET must_change_password = FALSE
WHERE must_change_password IS NULL;

-- Mark the seed/bootstrap admin as having no creator (self-bootstrapped).
-- All future users created via /api/admin/invite will have created_by set.

COMMENT ON COLUMN users.must_change_password IS
  'TRUE when an admin-issued temporary password has not yet been changed by the user.';

COMMENT ON COLUMN users.mfa_enrolled_at IS
  'Timestamp when the user completed their own TOTP enrollment. NULL means MFA not yet set up.';

COMMENT ON COLUMN users.created_by IS
  'ID of the admin/ceo who created this account. NULL for the bootstrap admin.';
