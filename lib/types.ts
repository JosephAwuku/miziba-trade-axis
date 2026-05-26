export type Role = 'deal_officer' | 'ceo' | 'cfo' | 'trader' | 'finance_partner' | 'ops_admin' | '__system__' | null;

export type View =
  | 'pipeline'
  | 'monitor'
  | 'portfolio'
  | 'risk_calc'
  | 'buyers'
  | 'aggregators'
  | 'aggregator_edit'
  | 'fp_crm'
  | 'settle'
  | 'cfo_overview'
  | 'ceo_overview'
  | 'ops_overview'
  | 'fps'
  | 'trs'
  | 'trs_overview'
  | 'trs_status'
  | 'trs_apply'
  | 'trs_drafts'
  | 'trs_docs'
  | 'trs_company'
  | 'trs_settle'
  | 'trs_verify'
  | 'fp_overview'
  | 'fp_dashboard'
  | 'fp_inbox'
  | 'fp_portfolio'
  | 'fp_reports'
  | 'fp_onboarding'
  | 'admin_onboard'
  | 'admin_user_edit'
  | 'buyer_edit'
  | 'admin_directory'
  | 'admin_verify'
  | 'admin_notifications'
  | 'admin_audit';

export interface Trade {
  id: string;
  tr: string;
  tid: string;
  cmd: 'cashew' | 'shea' | 'sesame' | 'sorghum' | 'soya';
  vol: number;
  gr: 'A' | 'B' | 'C';
  buyer: string;
  bc: string;
  price: number;
  cv: number;
  pc: number;
  eq: number;
  ff: number;
  dp: string;
  dl: string;
  pt: number;
  stage:
    | 'SUBMITTED'
    | 'UNDER_VALIDATION'
    | 'VALIDATED'
    | 'FINANCE_REVIEW'
    | 'FUNDED'
    | 'PROCURING'
    | 'DELIVERED'
    | 'SETTLED'
    | 'CLOSED';
  /** Company (organisation) KYC — one-time trader verification, not trade documents */
  traderOrgKyc: 'PENDING' | 'UNDER_REVIEW' | 'FLAGGED' | 'VERIFIED' | 'REJECTED';
  /** @deprecated Legacy trade row field; use traderOrgKyc for company status */
  kyc: 'PENDING' | 'FLAGGED' | 'VERIFIED';
  risk: number | null;
  off: string;
  dt: string;
  escrow: string | null;
  ship: string | null;
  bpay: number | null;
  dep: number;
  val: {
    b: boolean;
    p: boolean;
    s: boolean;
    k: boolean;
    r: boolean;
  };
  rb: RiskBreakdown | null;
  fp: string | null;
  bpd?: string;
  vp?: number;
  eudr?: number;
  gradeA?: number;
  gradeB?: number;
  gradeC?: number;
  deliveredWt?: number;
  wvariance?: number;
  mf?: number;
  fpr?: number;
  tm?: number;
  trader_org_id?: string;
  fp_org_id?: string;
}

export interface SettlementData {
  id: string;
  trade_id: string;
  status: 'initiated' | 'in_progress' | 'completed';
  total_amount: number;
  financed_amount: number;
  equity_amount: number;
  amount_paid: number;
  initiated_by: string;
  initiated_at: string;
  completed_at?: string;
}

export interface StageConfig {
  l: string;
  c: string;
  bg: string;
  br: string;
}

export interface CommodityConfig {
  c: string;
  i: string;
  l: string;
}

export interface BatchItem {
  id: string;
  fid: string;
  tp: string;
  wt: number;
  ghs: number;
  usd: number;
  st: 'CONFIRMED' | 'PENDING';
  ts: string;
}

export interface FPConfig {
  id: string;
  name: string;
  contact: string;
  email: string;
  trades: number;
  approved: number;
  capital: number;
  returned: number;
  avgReview: number | null;
  health: 'green' | 'amber' | 'red';
  nextCall: string;
  onboarding?: boolean;
}

// Additional types for API and backend integration

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  org_id: string;
  org_name: string;
  totp_enabled: boolean;
}

export interface TradeApplicationInput {
  commodity: 'cashew' | 'shea' | 'sesame' | 'sorghum' | 'soya';
  grade: 'A' | 'B' | 'C';
  volume_mt: number;
  buyer_id: string;
  price_per_mt_usd: number;
  procurement_cost_usd: number;
  trader_equity_usd: number;
  finance_facility_usd: number;
  delivery_point: string;
  deadline_date: string;
  payment_terms_days: number;
  draft_id?: string;
}

export interface TradeSummary {
  id: string;
  trade_ref: string;
  commodity: string;
  grade: string;
  volume_mt: number;
  price_per_mt_usd: number;
  contract_value_usd: number;
  finance_facility_usd: number;
  stage: string;
  /** Legacy column on trades row — do not use for company KYC display */
  kyc_status: string;
  /** Trader organisation company KYC from organisations.kyc_status */
  trader_org_kyc_status: string;
  risk_score: number | null;
  capital_deployed_pct: number;
  deadline_date: string;
  applied_at: string;
  trader_name: string;
  buyer_name: string;
}

export interface ValidationChecklist {
  business: {
    completed: boolean;
    items: Array<{ id: string; label: string; status: boolean; notes?: string }>;
  };
  product: {
    completed: boolean;
    items: Array<{ id: string; label: string; status: boolean; notes?: string }>;
  };
  shipping: {
    completed: boolean;
    items: Array<{ id: string; label: string; status: boolean; notes?: string }>;
  };
  kyc: {
    completed: boolean;
    items: Array<{ id: string; label: string; status: boolean; notes?: string }>;
  };
  risk: {
    completed: boolean;
    items: Array<{ id: string; label: string; status: boolean; notes?: string }>;
  };
}

export interface RiskTier {
  score: number;
  label: string;
}

export interface RiskDimension {
  key: keyof RiskBreakdown;
  label: string;
  max: number;
  weight: string;
  tiers: RiskTier[];
}

export interface RiskBreakdown {
  buyer_risk: number;
  trader_risk: number;
  commodity_price_risk: number;
  sourcing_supply_risk: number;
  logistics_delivery_risk: number;
}

export interface RiskAssessment {
  id: string;
  trade_id: string;
  risk_score: number;
  breakdown: RiskBreakdown;
  notes?: string;
  recommendations: string[];
  calculated_at: string;
  assessed_by?: string;
}

export interface FinanceDataPackage {
  id: string;
  trade_id: string;
  generated_by: string;
  generated_at: string;
  version: number;
  sent_to_fp_at?: string;
  sent_by?: string;
  pdf_s3_key?: string;
  pdf_ready: boolean;
}

export interface WaterfallInstruction {
  trade_id: string;
  buyer_payment_usd: number;
  fp_principal_usd: number;
  fp_fee_usd: number;
  mizaba_fee_usd: number;
  cfo_1_id: string;
  cfo_1_confirmed: boolean;
  cfo_1_confirmed_at?: string;
  cfo_2_id?: string;
  cfo_2_confirmed?: boolean;
  cfo_2_confirmed_at?: string;
  instructed_at?: string;
  status: 'PENDING' | 'INSTRUCTED' | 'COMPLETED';
  tradevault_ref?: string;
}

export interface Document {
  id: string;
  trade_id: string;
  doc_type: string;
  filename: string;
  s3_key: string;
  uploaded_by: string;
  uploaded_at: string;
  expires_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  trade_id?: string;
  channel: 'email' | 'in_app' | 'sms';
  type?: string; 
  subject: string;
  body: string;
  sent_at?: string;
  read_at?: string;
  created_at?: string;
}

export interface PortfolioMetrics {
  active_deals: number;
  total_contract_value: number;
  total_facility_value: number;
  avg_risk_score: number;
  default_rate: number;
  portfolio_value: number;
}

export interface BuyerProfile {
  id: string;
  name: string;
  country: string;
  sanctions_clear: boolean;
  sanctions_checked_at: string;
  trades_completed: number;
  trades_on_time: number;
  disputes: number;
}

export interface NonPaymentProtocol {
  id: string;
  trade_id: string;
  opened_by: string;
  opened_at: string;
  current_step: number;
  status: 'OPEN' | 'CLOSED';
}

export interface NonPaymentEscalation {
  id: string;
  protocol_id: string;
  step: number;
  escalated_at: string;
  resolved_at?: string;
  notes?: string;
}

export interface TradeClosureChecklist {
  trade_id: string;
  waterfall_confirmed: boolean;
  trr_received: boolean;
  ccc_received: boolean;
  buyer_perf_recorded: boolean;
  trader_rec_updated: boolean;
  fp_report_sent: boolean;
  record_locked: boolean;
  completed_by?: string;
  completed_at?: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  trade_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_value?: any;
  new_value?: any;
  ip_address?: string;
  timestamp: string;
}
