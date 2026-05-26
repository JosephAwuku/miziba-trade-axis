-- =============================================================================
-- Migration 0008: Add granular KYC verification tracking
-- Enables individual document approval and company profile/bank data validation
-- =============================================================================

-- Add granular verification status fields to organisations
ALTER TABLE organisations 
  ADD COLUMN IF NOT EXISTS company_profile_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS company_profile_verified_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS company_profile_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS company_profile_rejection_notes TEXT;

-- Add granular verification fields to trader_profiles for bank details
ALTER TABLE trader_profiles
  ADD COLUMN IF NOT EXISTS bank_details_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bank_details_verified_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS bank_details_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bank_details_rejection_notes TEXT;

-- Add rejection notes to organisation_documents for individual document feedback
ALTER TABLE organisation_documents
  ADD COLUMN IF NOT EXISTS rejection_notes TEXT;

-- Create index for faster verification queries
CREATE INDEX IF NOT EXISTS idx_org_profile_verified ON organisations(company_profile_verified);
CREATE INDEX IF NOT EXISTS idx_trader_bank_verified ON trader_profiles(bank_details_verified);

-- Add comment documenting the verification flow
COMMENT ON COLUMN organisations.company_profile_verified IS 'True when admin/CEO has verified company registration details (registration_no, TIN, address)';
COMMENT ON COLUMN trader_profiles.bank_details_verified IS 'True when admin/CEO has verified bank settlement details';
COMMENT ON COLUMN organisation_documents.rejection_notes IS 'Admin feedback when document is rejected - visible to trader for resubmission';

-- Create a view for quick verification status summary
CREATE OR REPLACE VIEW trader_verification_summary AS
SELECT 
  o.id as org_id,
  o.name as company_name,
  o.kyc_status,
  o.company_profile_verified,
  tp.bank_details_verified,
  COUNT(DISTINCT od.id) FILTER (WHERE od.status = 'VERIFIED') as docs_verified_count,
  COUNT(DISTINCT od.id) FILTER (WHERE od.status = 'REJECTED') as docs_rejected_count,
  COUNT(DISTINCT od.id) FILTER (WHERE od.status IN ('UPLOADED', 'UNDER_REVIEW')) as docs_pending_count,
  COUNT(DISTINCT od.id) as total_docs_count,
  -- Trader is only truly verified when ALL items are approved
  CASE 
    WHEN o.kyc_status = 'VERIFIED' 
      AND o.company_profile_verified = TRUE 
      AND tp.bank_details_verified = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM organisation_documents od2 
        WHERE od2.org_id = o.id 
        AND od2.status IN ('REJECTED', 'UPLOADED', 'UNDER_REVIEW')
      )
    THEN TRUE
    ELSE FALSE
  END as is_fully_verified
FROM organisations o
LEFT JOIN trader_profiles tp ON tp.org_id = o.id
LEFT JOIN organisation_documents od ON od.org_id = o.id
WHERE o.type = 'trader'
GROUP BY o.id, o.name, o.kyc_status, o.company_profile_verified, tp.bank_details_verified;

COMMENT ON VIEW trader_verification_summary IS 'Real-time verification status showing which items are pending, approved, or rejected for each trader';
