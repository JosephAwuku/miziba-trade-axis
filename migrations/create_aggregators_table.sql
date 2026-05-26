-- Create aggregators table
CREATE TABLE IF NOT EXISTS aggregators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  registration_no TEXT,
  sanctions_clear BOOLEAN DEFAULT true,
  sanctions_checked_at TIMESTAMPTZ,
  trades_completed INTEGER DEFAULT 0,
  trades_on_time INTEGER DEFAULT 0,
  trades_late INTEGER DEFAULT 0,
  avg_days_late NUMERIC,
  disputes INTEGER DEFAULT 0,
  creditworthiness_score NUMERIC CHECK (creditworthiness_score >= 0 AND creditworthiness_score <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for aggregator name lookups
CREATE INDEX IF NOT EXISTS idx_aggregators_name ON aggregators(name);

-- Create index for aggregator country lookups
CREATE INDEX IF NOT EXISTS idx_aggregators_country ON aggregators(country);

-- Enable RLS
ALTER TABLE aggregators ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users with specific roles to read aggregators
CREATE POLICY "Authorized staff can view aggregators" ON aggregators
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ceo', 'ops_admin', 'deal_officer')
    )
  );

-- RLS Policy: Allow authorized staff to insert aggregators
CREATE POLICY "Authorized staff can insert aggregators" ON aggregators
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ceo', 'ops_admin', 'deal_officer')
    )
  );

-- RLS Policy: Allow authorized staff to update aggregators
CREATE POLICY "Authorized staff can update aggregators" ON aggregators
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ceo', 'ops_admin', 'deal_officer')
    )
  );

-- RLS Policy: Allow authorized staff to delete aggregators
CREATE POLICY "Authorized staff can delete aggregators" ON aggregators
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ceo', 'ops_admin', 'deal_officer')
    )
  );
