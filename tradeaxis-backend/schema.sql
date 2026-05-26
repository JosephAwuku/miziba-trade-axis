-- =============================================================================
-- TRADEAXIS — PRODUCTION DATABASE SCHEMA v2
-- Miziba Infrastructure Ltd | Module 4 | PostgreSQL 15+
-- Gap fixes: ops_admin role, trader bank fields, dual CFO approval,
--            idempotency keys, session 1h expiry, trade_tranches,
--            monetary format note, export_licence_ref
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
CREATE TYPE trade_stage AS ENUM (
  'SUBMITTED','UNDER_VALIDATION','VALIDATED','FINANCE_REVIEW',
  'FUNDED','PROCURING','DELIVERED','SETTLED','CLOSED');
CREATE TYPE kyc_status AS ENUM ('PENDING','UNDER_REVIEW','VERIFIED','FLAGGED','REJECTED');
CREATE TYPE commodity_type AS ENUM ('cashew','shea','sesame','sorghum','soya');
CREATE TYPE commodity_grade AS ENUM ('A','B','C');
-- SIX roles per spec §2 (added ops_admin)
CREATE TYPE user_role AS ENUM (
  'deal_officer','ceo','cfo','trader','finance_partner','ops_admin');
CREATE TYPE document_status AS ENUM ('PENDING','UPLOADED','UNDER_REVIEW','ACCEPTED','REJECTED');
CREATE TYPE batch_status AS ENUM ('PENDING','CONFIRMED','FAILED');
CREATE TYPE fp_health AS ENUM ('green','amber','red');
CREATE TYPE notification_channel AS ENUM ('email','sms','in_app');
CREATE TYPE notification_status AS ENUM ('QUEUED','SENT','FAILED','READ');
CREATE TYPE escalation_decision AS ENUM ('approve_direct','require_validation','decline');
CREATE TYPE waterfall_status AS ENUM ('PENDING','INSTRUCTED','CONFIRMED','FAILED');
CREATE TYPE shipment_status AS ENUM ('CREATED','IN_TRANSIT','ALERT','DELIVERING','DELIVERED');

-- MONETARY FORMAT NOTE:
-- All monetary columns stored as NUMERIC(14,2) in USD.
-- API serialiser converts to BIGINT cents (x100) for responses.
-- API deserialiser converts from BIGINT cents to NUMERIC on write (÷100).
-- This matches spec §15: "All monetary values in API responses: USD cents (BIGINT)."

-- ORGANISATIONS
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('miziba','trader','finance_partner','buyer')),
  country TEXT NOT NULL DEFAULT 'GH',
  registration_no TEXT, tin TEXT, address TEXT, phone TEXT, email TEXT,
  kyc_status kyc_status NOT NULL DEFAULT 'PENDING',
  kyc_verified_at TIMESTAMPTZ, kyc_verified_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_org_type ON organisations(type);
CREATE INDEX idx_org_kyc ON organisations(kyc_status);

-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  email TEXT NOT NULL UNIQUE, phone TEXT, full_name TEXT NOT NULL,
  role user_role NOT NULL,
  password_hash TEXT NOT NULL,         -- bcrypt, min 12 chars enforced at API layer
  totp_secret TEXT,                    -- TOTP 2FA secret
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- 2FA mandatory for ceo/cfo/ops_admin — enforced in login middleware
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,            -- 15-min lockout after 5 failed attempts
  last_login_at TIMESTAMPTZ,
  password_reset_token TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- IDEMPOTENCY KEYS (all financial POST endpoints require Idempotency-Key header)
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days');
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

-- TRADER PROFILES (added bank fields + export_licence_ref from spec §4.2)
CREATE TABLE trader_profiles (
  org_id UUID PRIMARY KEY REFERENCES organisations(id),
  bank_account_name TEXT,              -- Must match company name
  bank_account_number TEXT,            -- Encrypted at application layer
  bank_name TEXT,
  bank_swift TEXT,
  export_licence_ref TEXT,
  export_licence_expiry DATE,
  trades_completed INTEGER NOT NULL DEFAULT 0,
  trades_defaulted INTEGER NOT NULL DEFAULT 0,
  total_volume_mt NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_value_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  risk_score INTEGER,
  risk_score_updated_at TIMESTAMPTZ,
  equity_min_pct NUMERIC(5,2) NOT NULL DEFAULT 35.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

-- FINANCE PARTNER PROFILES
CREATE TABLE finance_partner_profiles (
  org_id UUID PRIMARY KEY REFERENCES organisations(id),
  contact_name TEXT, contact_email TEXT,
  bank_name TEXT, bank_swift TEXT,
  bank_account_no TEXT,                -- Encrypted at application layer
  bank_account_name TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  min_deal_size_usd NUMERIC(12,2), max_deal_size_usd NUMERIC(12,2),
  standard_fee_rate NUMERIC(5,4),
  onboarding_step INTEGER NOT NULL DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 6),
  onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
  next_interaction DATE,
  health fp_health NOT NULL DEFAULT 'amber',
  framework_signed BOOLEAN NOT NULL DEFAULT FALSE, framework_signed_at TIMESTAMPTZ,
  portal_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

-- BUYERS
CREATE TABLE buyers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, country TEXT NOT NULL, registration_no TEXT,
  sanctions_clear BOOLEAN NOT NULL DEFAULT FALSE, sanctions_checked_at TIMESTAMPTZ,
  trades_completed INTEGER NOT NULL DEFAULT 0,
  trades_on_time INTEGER NOT NULL DEFAULT 0,
  trades_late INTEGER NOT NULL DEFAULT 0,
  avg_days_late NUMERIC(5,1),
  disputes INTEGER NOT NULL DEFAULT 0,
  creditworthiness_score INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_buyers_name ON buyers(name);

-- TRADES
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_ref TEXT NOT NULL UNIQUE,
  trader_org_id UUID NOT NULL REFERENCES organisations(id),
  buyer_id UUID NOT NULL REFERENCES buyers(id),
  fp_org_id UUID REFERENCES organisations(id),
  deal_officer_id UUID REFERENCES users(id),
  commodity commodity_type NOT NULL,
  grade commodity_grade NOT NULL DEFAULT 'A',
  volume_mt NUMERIC(10,2) NOT NULL,
  price_per_mt_usd NUMERIC(10,2) NOT NULL,
  contract_value_usd NUMERIC(14,2) GENERATED ALWAYS AS (volume_mt * price_per_mt_usd) STORED,
  procurement_cost_usd NUMERIC(14,2) NOT NULL,
  trader_equity_usd NUMERIC(14,2) NOT NULL,
  finance_facility_usd NUMERIC(14,2) NOT NULL,
  trader_equity_pct NUMERIC(5,4) GENERATED ALWAYS AS (trader_equity_usd / NULLIF(procurement_cost_usd,0)) STORED,
  -- e.g. 0.3500 = 35%. Spec §14.2 explicitly defines trader_equity_pct DECIMAL(5,4)
  miziba_struct_fee_usd NUMERIC(12,2) GENERATED ALWAYS AS (finance_facility_usd * 0.01) STORED,
  miziba_settle_fee_usd NUMERIC(12,2),
  delivery_point TEXT NOT NULL,
  deadline_date DATE NOT NULL,
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  stage trade_stage NOT NULL DEFAULT 'SUBMITTED',
  kyc_status kyc_status NOT NULL DEFAULT 'PENDING',
  risk_score INTEGER,
  escrow_id TEXT, shipment_id TEXT,
  is_multi_tranche BOOLEAN NOT NULL DEFAULT FALSE,
  capital_deployed_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  volume_procured_mt NUMERIC(10,2) NOT NULL DEFAULT 0,
  eudr_compliance_pct NUMERIC(5,2),
  grade_a_pct NUMERIC(5,2), grade_b_pct NUMERIC(5,2), grade_c_pct NUMERIC(5,2),
  delivered_weight_mt NUMERIC(10,2), weight_variance_pct NUMERIC(5,2),
  buyer_payment_usd NUMERIC(14,2), buyer_payment_date DATE,
  settlement_status waterfall_status NOT NULL DEFAULT 'PENDING',
  declined_at TIMESTAMPTZ, declined_by UUID REFERENCES users(id), decline_reason TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ, funded_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ, settled_at TIMESTAMPTZ, closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT equity_min CHECK (trader_equity_usd >= procurement_cost_usd * 0.35),
  CONSTRAINT facility_sum CHECK (ABS((trader_equity_usd + finance_facility_usd) - procurement_cost_usd) < 1));
CREATE INDEX idx_trades_stage ON trades(stage);
CREATE INDEX idx_trades_trader ON trades(trader_org_id);
CREATE INDEX idx_trades_fp ON trades(fp_org_id);
CREATE INDEX idx_trades_ref ON trades(trade_ref);
CREATE INDEX idx_trades_commodity ON trades(commodity);
CREATE INDEX idx_trades_deadline ON trades(deadline_date);

CREATE SEQUENCE trade_seq START 1;
CREATE OR REPLACE FUNCTION generate_trade_ref() RETURNS TRIGGER AS $$
BEGIN
  NEW.trade_ref := 'BR-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(NEXTVAL('trade_seq')::TEXT,4,'0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_trade_ref BEFORE INSERT ON trades FOR EACH ROW
  WHEN (NEW.trade_ref IS NULL OR NEW.trade_ref = '') EXECUTE FUNCTION generate_trade_ref();

-- TRADE TRANCHES (Phase 2 — Q1 2027 multi-FP split allocation per spec §6.2)
-- Schema defined now so Phase 2 migration is non-breaking.
-- Phase 1: is_multi_tranche=FALSE, zero tranche records for all trades.
-- Phase 2: is_multi_tranche=TRUE, 2+ tranche records per split trade.
-- Waterfall: all tranches paid pari passu (proportional to tranche_amount_usd).
CREATE TABLE trade_tranches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  tranche_ref TEXT NOT NULL UNIQUE,
  fp_org_id UUID NOT NULL REFERENCES organisations(id),
  tranche_amount_usd NUMERIC(14,2) NOT NULL,
  fee_rate_pa NUMERIC(5,4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','FUNDED','SETTLED','DECLINED')),
  fp_decision_at TIMESTAMPTZ, fp_decided_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_tranches_trade ON trade_tranches(trade_id);

-- VALIDATION
-- VALIDATION TABLE per spec §5.1 and §14.2
-- Five items: buyer_verified, price_reasonable, sourcing_feasible, trader_qualified, margin_viable
-- Note: 5th item is MARGIN & RISK ASSESSMENT (not regulatory compliance)
-- Per-item notes fields per spec §14.2 validation_records schema
CREATE TABLE trade_validations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE UNIQUE,
  -- Item 1: Buyer Verification (§5.1.1)
  buyer_verified BOOLEAN NOT NULL DEFAULT FALSE,
  buyer_notes TEXT,
  -- Item 2: Price Reasonableness (§5.1.2)
  price_reasonable BOOLEAN NOT NULL DEFAULT FALSE,
  price_notes TEXT,
  -- Item 3: Sourcing Capacity (§5.1.3)
  sourcing_feasible BOOLEAN NOT NULL DEFAULT FALSE,
  sourcing_notes TEXT,
  -- Item 4: Trader KYC & Track Record (§5.1.4)
  trader_qualified BOOLEAN NOT NULL DEFAULT FALSE,
  trader_notes TEXT,
  -- Item 5: Margin & Risk Assessment (§5.1.5) — NOT regulatory compliance
  margin_viable BOOLEAN NOT NULL DEFAULT FALSE,
  margin_notes TEXT,
  -- Outcome (§5.3): validated / declined / referred
  decision VARCHAR(20) CHECK (decision IN ('validated','declined','referred')),
  decline_reason TEXT,
  -- Signatures
  validated_by UUID REFERENCES users(id),
  ceo_approved_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

-- RISK SCORES
CREATE TABLE trade_risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE UNIQUE,
  buyer_risk INTEGER NOT NULL CHECK (buyer_risk BETWEEN 0 AND 25),
  trader_risk INTEGER NOT NULL CHECK (trader_risk BETWEEN 0 AND 25),
  commodity_price_risk INTEGER NOT NULL CHECK (commodity_price_risk BETWEEN 0 AND 20),
  sourcing_supply_risk INTEGER NOT NULL CHECK (sourcing_supply_risk BETWEEN 0 AND 15),
  logistics_delivery_risk INTEGER NOT NULL CHECK (logistics_delivery_risk BETWEEN 0 AND 15),
  total_score INTEGER GENERATED ALWAYS AS (buyer_risk+trader_risk+commodity_price_risk+sourcing_supply_risk+logistics_delivery_risk) STORED,
  scored_by UUID NOT NULL REFERENCES users(id), scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), notes TEXT);

-- CEO ESCALATIONS
CREATE TABLE ceo_escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE UNIQUE,
  escalated_by UUID NOT NULL REFERENCES users(id), escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT, decision escalation_decision, decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ, notes TEXT);

-- FINANCE DATA PACKAGES
CREATE TABLE finance_data_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id),
  version INTEGER NOT NULL DEFAULT 1,
  generated_by UUID NOT NULL REFERENCES users(id), generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_to_fp_at TIMESTAMPTZ, sent_by UUID REFERENCES users(id),
  pdf_s3_key TEXT, pdf_ready BOOLEAN NOT NULL DEFAULT FALSE,
  is_current BOOLEAN NOT NULL DEFAULT TRUE, checksum TEXT);
CREATE INDEX idx_fdp_trade ON finance_data_packages(trade_id);

-- FP DECISIONS
CREATE TABLE fp_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id),
  fp_org_id UUID NOT NULL REFERENCES organisations(id),
  decision TEXT NOT NULL CHECK (decision IN ('approve','decline','info_request')),
  decided_by UUID NOT NULL REFERENCES users(id), decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT, info_request TEXT,
  UNIQUE(trade_id, fp_org_id));

-- TERM SHEETS
CREATE TABLE term_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','EXECUTED','SUPERSEDED')),
  facility_amount_usd NUMERIC(14,2) NOT NULL,
  fee_rate_pa NUMERIC(5,4) NOT NULL, tenor_days INTEGER NOT NULL,
  governing_law TEXT NOT NULL DEFAULT 'Republic of Ghana',
  docusign_envelope_id TEXT, executed_at TIMESTAMPTZ, s3_key TEXT,
  created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_termsheet_trade ON term_sheets(trade_id);

-- DEPLOYMENT BATCHES
CREATE TABLE deployment_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_ref TEXT NOT NULL UNIQUE, trade_id UUID NOT NULL REFERENCES trades(id),
  farmer_id_anon TEXT NOT NULL, tradepoint_id UUID REFERENCES organisations(id),
  tradepoint_name TEXT, weight_kg NUMERIC(10,2) NOT NULL,
  amount_ghs NUMERIC(12,2) NOT NULL, amount_usd NUMERIC(12,2) NOT NULL,
  status batch_status NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ, tradevault_tx_id TEXT,
  eudr_verified BOOLEAN NOT NULL DEFAULT FALSE, grade commodity_grade,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_batches_trade ON deployment_batches(trade_id);
CREATE INDEX idx_batches_status ON deployment_batches(status);

-- SHIPMENT RECORDS
CREATE TABLE shipment_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) UNIQUE,
  trackguard_id TEXT NOT NULL UNIQUE, status shipment_status NOT NULL DEFAULT 'CREATED',
  origin TEXT, destination TEXT, departed_at TIMESTAMPTZ, eta TIMESTAMPTZ, delivered_at TIMESTAMPTZ,
  last_gps_lat NUMERIC(10,7), last_gps_lng NUMERIC(10,7), last_gps_city TEXT, last_update TIMESTAMPTZ,
  delivered_weight_mt NUMERIC(10,2), weight_variance_pct NUMERIC(5,2),
  ccc_issued BOOLEAN NOT NULL DEFAULT FALSE, ccc_s3_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE shipment_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipment_records(id),
  alert_type TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO','WARN','CRITICAL')),
  message TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL, resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_alerts_shipment ON shipment_alerts(shipment_id);

-- WATERFALL INSTRUCTIONS — dual CFO approval per spec §12.2
CREATE TABLE waterfall_instructions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) UNIQUE,
  buyer_payment_usd NUMERIC(14,2) NOT NULL,
  fp_principal_usd NUMERIC(14,2) NOT NULL,
  fp_fee_usd NUMERIC(12,2) NOT NULL,
  fp_total_usd NUMERIC(14,2) GENERATED ALWAYS AS (fp_principal_usd + fp_fee_usd) STORED,
  miziba_fee_usd NUMERIC(12,2) NOT NULL,
  trader_margin_usd NUMERIC(12,2) GENERATED ALWAYS AS
    (buyer_payment_usd - (fp_principal_usd + fp_fee_usd) - miziba_fee_usd) STORED,
  status waterfall_status NOT NULL DEFAULT 'PENDING',
  -- Dual CFO (spec §12.2: two named CFO-level users must both confirm)
  cfo_1_id UUID REFERENCES users(id),
  cfo_1_confirmed BOOLEAN NOT NULL DEFAULT FALSE, cfo_1_confirmed_at TIMESTAMPTZ,
  cfo_2_id UUID REFERENCES users(id),
  cfo_2_confirmed BOOLEAN NOT NULL DEFAULT FALSE, cfo_2_confirmed_at TIMESTAMPTZ,
  both_confirmed BOOLEAN GENERATED ALWAYS AS (cfo_1_confirmed AND cfo_2_confirmed) STORED,
  instructed_at TIMESTAMPTZ,
  fp_payment_confirmed BOOLEAN NOT NULL DEFAULT FALSE, fp_confirmed_at TIMESTAMPTZ,
  miziba_received BOOLEAN NOT NULL DEFAULT FALSE, trader_released BOOLEAN NOT NULL DEFAULT FALSE,
  tradevault_ref TEXT,
  shortfall BOOLEAN NOT NULL DEFAULT FALSE, shortfall_amount_usd NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- FP always paid first (DB-enforced, not just application-level)
  CONSTRAINT fp_paid_before_trader CHECK (NOT (trader_released=TRUE AND fp_payment_confirmed=FALSE)),
  -- Both CFOs must confirm before instruction executes
  CONSTRAINT dual_cfo_before_instruction CHECK (NOT (instructed_at IS NOT NULL AND both_confirmed=FALSE)));

-- NON-PAYMENT PROTOCOL
CREATE TABLE non_payment_protocols (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) UNIQUE,
  opened_by UUID NOT NULL REFERENCES users(id), opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
  resolved BOOLEAN NOT NULL DEFAULT FALSE, resolved_at TIMESTAMPTZ, resolution_note TEXT);
CREATE TABLE non_payment_escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocol_id UUID NOT NULL REFERENCES non_payment_protocols(id),
  step INTEGER NOT NULL CHECK (step BETWEEN 1 AND 5),
  escalated_by UUID NOT NULL REFERENCES users(id), escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), notes TEXT);

-- CLOSURE CHECKLIST
CREATE TABLE trade_closure_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) UNIQUE,
  waterfall_confirmed BOOLEAN NOT NULL DEFAULT FALSE, waterfall_confirmed_at TIMESTAMPTZ,
  trr_received BOOLEAN NOT NULL DEFAULT FALSE, trr_received_at TIMESTAMPTZ,
  ccc_received BOOLEAN NOT NULL DEFAULT FALSE, ccc_received_at TIMESTAMPTZ,
  buyer_perf_recorded BOOLEAN NOT NULL DEFAULT FALSE, buyer_perf_at TIMESTAMPTZ,
  trader_rec_updated BOOLEAN NOT NULL DEFAULT FALSE, trader_rec_at TIMESTAMPTZ,
  fp_report_sent BOOLEAN NOT NULL DEFAULT FALSE, fp_report_at TIMESTAMPTZ,
  record_locked BOOLEAN NOT NULL DEFAULT FALSE, locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES users(id), completed_by UUID REFERENCES users(id));

-- DOCUMENTS
CREATE TABLE trade_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id),
  doc_type TEXT NOT NULL, name TEXT NOT NULL, s3_key TEXT NOT NULL UNIQUE,
  s3_bucket TEXT NOT NULL DEFAULT 'miziba-tradeaxis-docs',
  size_bytes BIGINT, mime_type TEXT, checksum_sha256 TEXT,
  status document_status NOT NULL DEFAULT 'UPLOADED',
  reviewed_by UUID REFERENCES users(id), reviewed_at TIMESTAMPTZ,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE, locked_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES users(id), uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_docs_trade ON trade_documents(trade_id);
CREATE INDEX idx_docs_type ON trade_documents(doc_type);

-- ORGANISATION DOCUMENTS
CREATE TABLE organisation_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED','UNDER_REVIEW','VERIFIED','REJECTED')),
  uploaded_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, doc_type));
CREATE INDEX idx_org_docs_org ON organisation_documents(org_id);
CREATE INDEX idx_org_docs_status ON organisation_documents(status);

CREATE TABLE document_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id UUID NOT NULL REFERENCES trade_documents(id),
  accessed_by UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('VIEW','DOWNLOAD','UPLOAD','LOCK')),
  ip_address INET, user_agent TEXT, accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_dacl_doc ON document_access_log(doc_id);
CREATE INDEX idx_dacl_user ON document_access_log(accessed_by);

-- STAGE LOG
CREATE TABLE trade_stage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id),
  from_stage trade_stage, to_stage trade_stage NOT NULL,
  changed_by UUID REFERENCES users(id), changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), notes TEXT);
CREATE INDEX idx_stage_log_trade ON trade_stage_log(trade_id);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id), trade_id UUID REFERENCES trades(id),
  type TEXT NOT NULL DEFAULT 'info',
  channel notification_channel NOT NULL DEFAULT 'in_app',
  status notification_status NOT NULL DEFAULT 'QUEUED',
  subject TEXT, body TEXT NOT NULL, template_id TEXT,
  sent_at TIMESTAMPTZ, read_at TIMESTAMPTZ, failed_at TIMESTAMPTZ,
  failure_reason TEXT, retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_status ON notifications(status);
CREATE INDEX idx_notif_trade ON notifications(trade_id);

-- WEBHOOK EVENTS
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL CHECK (source IN ('tradevault','trackguard')),
  event_type TEXT NOT NULL, payload JSONB NOT NULL,
  trade_id UUID REFERENCES trades(id),
  processed BOOLEAN NOT NULL DEFAULT FALSE, processed_at TIMESTAMPTZ, error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_webhooks_source ON webhook_events(source);
CREATE INDEX idx_webhooks_processed ON webhook_events(processed);

-- RISK HISTORY
CREATE TABLE trader_risk_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trader_org_id UUID NOT NULL REFERENCES organisations(id),
  trade_id UUID NOT NULL REFERENCES trades(id),
  score INTEGER NOT NULL, scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), label TEXT);
CREATE INDEX idx_risk_hist_trader ON trader_risk_history(trader_org_id);

-- PORTFOLIO METRICS CACHE
CREATE TABLE portfolio_metrics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_deals INTEGER, total_contract_value_usd NUMERIC(14,2),
  total_facility_usd NUMERIC(14,2), avg_risk_score NUMERIC(5,2),
  default_rate_pct NUMERIC(5,2), avg_trade_cycle_days NUMERIC(5,2),
  farmer_sla_compliance_pct NUMERIC(5,2), weight_reconciliation_pct NUMERIC(5,2),
  fp_return_min_pct NUMERIC(5,2), fp_return_max_pct NUMERIC(5,2),
  farmers_reached INTEGER, total_volume_mt NUMERIC(12,2),
  countries_active INTEGER, female_trader_pct NUMERIC(5,2));

-- AUDIT LOG (append-only)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id), trade_id UUID REFERENCES trades(id),
  action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id UUID,
  old_value JSONB, new_value JSONB, ip_address INET,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_trade ON audit_log(trade_id);
CREATE INDEX idx_audit_at ON audit_log(occurred_at);
-- After creating app user: REVOKE UPDATE, DELETE ON audit_log FROM tradeaxis_app;

-- SESSIONS (1-hour expiry per spec)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  requires_2fa_reauth BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address INET, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- SYSTEM CONFIG (ops_admin managed)
CREATE TABLE system_config (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT,
  updated_by UUID REFERENCES users(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO system_config (key,value,description) VALUES
  ('dual_cfo_required','true','Require two CFO confirmations for waterfall release'),
  ('equity_minimum_pct','35','Minimum trader equity as % of procurement cost'),
  ('eudr_threshold_pct','95','Minimum EUDR compliance % before alert fires'),
  ('grade_a_minimum_pct','75','Minimum Grade A % per contract requirement'),
  ('session_expiry_minutes','60','Session token expiry in minutes'),
  ('max_failed_logins','5','Max failed logins before lockout'),
  ('lockout_minutes','15','Lockout duration in minutes'),
  ('idempotency_ttl_days','7','Idempotency key retention in days'),
  ('fp_review_window_days','5','Finance partner standard review window');

-- TRIGGERS
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at=NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DO $$ DECLARE t TEXT;
BEGIN FOR t IN SELECT unnest(ARRAY['organisations','users','trader_profiles',
  'finance_partner_profiles','buyers','trades','trade_tranches','trade_validations',
  'deployment_batches','shipment_records','waterfall_instructions','system_config'])
  LOOP EXECUTE FORMAT('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',t);
  END LOOP; END; $$;

CREATE OR REPLACE FUNCTION log_stage_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO trade_stage_log(trade_id,from_stage,to_stage,changed_by)
    VALUES(NEW.id,OLD.stage,NEW.stage,
           COALESCE(NULLIF(CURRENT_SETTING('app.current_user_id',TRUE),'')::UUID,NULL));
  END IF; RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_stage_change AFTER UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION log_stage_change();

CREATE OR REPLACE FUNCTION prevent_closed_modification() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage='CLOSED' AND TG_OP='UPDATE' THEN
    RAISE EXCEPTION 'Cannot modify CLOSED trade %. Record is immutable.',OLD.id;
  END IF; RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_lock_closed BEFORE UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION prevent_closed_modification();

CREATE OR REPLACE FUNCTION enforce_waterfall_order() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.trader_released=TRUE AND NEW.fp_payment_confirmed=FALSE THEN
    RAISE EXCEPTION 'WATERFALL VIOLATION: FP must be confirmed paid before trader margin release. trade_id=%',NEW.trade_id;
  END IF; RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_waterfall_order BEFORE INSERT OR UPDATE ON waterfall_instructions FOR EACH ROW EXECUTE FUNCTION enforce_waterfall_order();

CREATE OR REPLACE FUNCTION set_doc_expiry() RETURNS TRIGGER AS $$
BEGIN NEW.expires_at:=NOW()+INTERVAL '7 years'; RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_doc_expiry BEFORE INSERT ON trade_documents FOR EACH ROW EXECUTE FUNCTION set_doc_expiry();

CREATE OR REPLACE FUNCTION generate_trade_ref() RETURNS TRIGGER AS $$
BEGIN NEW.trade_ref:='BR-'||TO_CHAR(NOW(),'YYYY')||'-'||LPAD(NEXTVAL('trade_seq')::TEXT,4,'0'); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- SEED
INSERT INTO organisations(id,name,type,country,registration_no,email,kyc_status)
VALUES('00000000-0000-0000-0000-000000000001','Miziba Infrastructure Ltd','miziba','GH','CS084902024','ops@miziba.com','VERIFIED')
ON CONFLICT DO NOTHING;

-- END OF SCHEMA v2

-- END OF SCHEMA v2
