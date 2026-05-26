-- Migration: Create Draft Trades Table
-- Description: Allows traders to save trade applications as drafts before submission
-- Date: 2026-05-08

CREATE TABLE IF NOT EXISTS draft_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trader_org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Trade application data (stored as JSONB for flexibility)
  draft_data JSONB NOT NULL,
  
  -- Metadata
  title TEXT,
  last_edited_step INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_draft_trades_trader_org ON draft_trades(trader_org_id);
CREATE INDEX IF NOT EXISTS idx_draft_trades_created_by ON draft_trades(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_draft_trades_updated ON draft_trades(updated_at DESC);

-- RLS Policies
ALTER TABLE draft_trades ENABLE ROW LEVEL SECURITY;

-- Traders can only see/manage their own org's drafts
CREATE POLICY "traders_own_drafts" ON draft_trades
  FOR ALL
  USING (
    trader_org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Staff can view all drafts (read-only for visibility)
CREATE POLICY "staff_view_drafts" ON draft_trades
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('ceo', 'deal_officer', 'ops_admin')
    )
  );

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_draft_trades_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_draft_trades_updated_at
  BEFORE UPDATE ON draft_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_draft_trades_timestamp();

COMMENT ON TABLE draft_trades IS 'Stores draft trade applications that have not been submitted yet';
