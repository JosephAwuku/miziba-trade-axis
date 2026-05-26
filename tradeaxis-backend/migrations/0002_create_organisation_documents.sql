-- Migration: Create organisation_documents table
-- Description: Stores KYC/company document metadata per organisation.
-- Date: 2026-05-05

CREATE TABLE IF NOT EXISTS organisation_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED')),
  uploaded_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_org_docs_org_id ON organisation_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_org_docs_status ON organisation_documents(status);
