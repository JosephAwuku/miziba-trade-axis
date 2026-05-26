# TradeAxis Operational Workflows

This document describes **exactly how** each business process flows through the platform — who does what, which screens they use, what data moves where, and what happens next.

---

## 1. Trader Onboarding & KYC Verification

### Overview
Before a trader can submit trade applications, they must complete KYC verification. This is a **one-time** process per trader organization.

### Step-by-Step Flow

#### Step 1: Admin Creates Trader Account
**Actor:** Ops Admin or CEO  
**Screen:** Admin Dashboard → User Management → Add User  
**Action:**
1. Click "Add User"
2. Fill out form:
   - Full Name (trader contact person)
   - Email
   - Organization/Company Name
   - Role: **Trader**
   - Temporary Password (auto-generated or manual)
3. Click "Create User Account"

**What Happens:**
- **API:** `POST /api/admin/invite`
- **Database:**
  - New row in `organisations` table (type: `trader`, kyc_status: `PENDING`)
  - New row in `users` table (role: `trader`, must_change_password: `true`, totp_enabled: `false`)
  - New row in `trader_profiles` table (linked to org)
- **Notification:** Trader receives email with login credentials (manual or future automated)

---

#### Step 2: Trader First Login
**Actor:** Trader  
**Screen:** Login page  
**Action:**
1. Enter email + temporary password
2. System forces password change
3. System forces 2FA setup (TOTP/Google Authenticator)

**What Happens:**
- **API:** 
  - `POST /api/auth/login` → returns `next_step: PASSWORD_CHANGE_REQUIRED`
  - `POST /api/auth/change-password` → returns `next_step: MFA_SETUP_REQUIRED`
  - `POST /api/auth/2fa/setup` → generates TOTP secret, shows QR code
  - `POST /api/auth/2fa/verify` → confirms TOTP working → full login
- **Database:**
  - `users.must_change_password` → `false`
  - `users.totp_enabled` → `true`
  - `users.mfa_enrolled_at` → timestamp

---

#### Step 3: Trader Completes KYC Form
**Actor:** Trader  
**Screen:** Trader Portal → Company Verification  
**Action:**
1. Fill out company details:
   - Registrar General Number
   - TIN Number
   - Company Address
   - Bank Name, Account Number, Branch, SWIFT
2. Upload required documents:
   - Certificate of Incorporation
   - Tax Clearance Certificate
   - Bank Statement (last 3 months)
   - Export License
   - Business Registration
3. Click "Submit for Verification"

**What Happens:**
- **API:**
  - `POST /api/trader/documents` (for each file upload)
    - Uploads to Supabase Storage bucket: `miziba-tradeaxis-docs/kyc/`
    - Creates row in `organisation_documents` (status: `UPLOADED`)
  - `POST /api/trader/onboard` (final submission)
    - Updates `organisations` (registration_no, tin, address)
    - Updates `trader_profiles` (bank details)
    - Sets `organisations.kyc_status` → `UNDER_REVIEW`
- **Notification:** 
  - Internal notification to Ops Admin / CEO: "New trader submitted KYC"

---

#### Step 4: Admin Reviews and Approves KYC
**Actor:** CEO or Ops Admin **only** (Deal Officers are notified but cannot approve/reject)
**Screen:** Admin Dashboard → Verification Inbox
**Action:**
1. Click on trader in "Pending Verifications" list
2. Review uploaded documents (download/view each)
3. Check form data (company details, bank info)
4. Verify against external databases (optional manual check)
5. Decision:
   - **Approve:** Click "Verify Trader"
   - **Reject:** Click "Reject" + add notes

**What Happens:**
- **API:** `POST /api/admin/verify`
  - Body: `{ org_id, decision: 'VERIFIED' or 'REJECTED', notes }`
- **Database:**
  - `organisations.kyc_status` → `VERIFIED` or `REJECTED`
  - `organisations.kyc_verified_at` → timestamp (if verified)
  - `organisations.kyc_verified_by` → admin user ID
- **Notification:**
  - Trader gets notification: "Your KYC has been verified" or "KYC rejected: [reason]"

---

#### Step 5: Trader Can Now Submit Trades
**Actor:** Trader  
**Screen:** Trader Portal → New Trade Application  
**Status:** KYC must be `VERIFIED` before this option is enabled

---

## 2. Trade Submission & Lifecycle

### Overview
A verified trader submits a trade application. It flows through validation, risk scoring, FDP generation, FP approval, procurement, delivery, settlement, and closure.

### Stage Transitions

```
SUBMITTED → UNDER_VALIDATION → VALIDATED → FINANCE_REVIEW → FUNDED → 
PROCURING → DELIVERED → SETTLED → CLOSED
```

---

### Stage 1: SUBMITTED

#### Actor: Trader
**Screen:** Trader Portal → New Trade Application  
**Action:**
1. Fill out trade details:
   - Commodity (cashew, shea, sesame, etc.)
   - Grade
   - Volume (MT)
   - Price per MT (USD)
   - Buyer (select from dropdown or request new buyer)
   - Delivery Point
   - Deadline Date
   - Payment Terms (days)
   - Procurement Cost (total USD)
   - Trader Equity (min 35% of procurement cost)
   - Finance Facility Requested (=procurement cost - equity)
2. Upload initial documents:
   - Purchase Order from Buyer
   - Pro Forma Invoice
   - Export License
3. Click "Submit Trade"

**What Happens:**
- **API:** `POST /api/trades`
- **Validation:**
  - Equity ≥ 35% of procurement cost
  - Equity + Facility = Procurement Cost
  - All required fields present
- **Database:**
  - New row in `trades` (stage: `SUBMITTED`, kyc_status: `PENDING`)
  - New row in `trade_validations` (all checkboxes false)
  - New row in `trade_closure_checklists` (all checkboxes false)
  - Uploaded docs → `trade_documents` table
- **Notification:**
  - Deal Officer, Ops Admin, CEO get notification: "New trade submitted: [trade_ref]"

---

### Stage 2: UNDER_VALIDATION

#### Actor: Deal Officer (or CEO)
**Screen:** Trade Operations → Click on trade → Validation Tab  
**Action:**
1. Review trade details
2. Check uploaded documents
3. Perform five validation checks:
   - ☐ **Price Reasonable:** Market price comparison
   - ☐ **Sourcing Feasible:** Can trader source this volume?
   - ☐ **Buyer Verified:** Buyer exists, payment history good
   - ☐ **Trader Qualified:** Trader has capacity, good track record
   - ☐ **Margin Viable:** Deal makes financial sense for all parties
4. For each check:
   - Mark as complete/incomplete
   - Add notes explaining decision
5. If documents missing:
   - Request additional docs from trader (manual notification/email)

**What Happens:**
- **API:** `PATCH /api/trades/[id]/validation`
- **Database:**
  - Updates `trade_validations` row:
    - `price_reasonable`, `sourcing_feasible`, `buyer_verified`, `trader_qualified`, `margin_viable` → `true`/`false`
    - `notes` field for each item
  - `trades.stage` remains `UNDER_VALIDATION` until all 5 are complete

**When Complete:**
- All 5 validation items = true
- Deal Officer clicks "Advance to Validated"
- **API:** `PATCH /api/trades/[id]` with `{ stage: 'VALIDATED' }`

---

### Stage 3: VALIDATED

#### Actor: Deal Officer (or CEO if escalated)
**Screen:** Trade Operations → Click on trade → Risk Tab  
**Action:**
1. Open Risk Scoring tool
2. Score each risk dimension (1-5 scale):
   - **Market Risk:** Price volatility, supply/demand
   - **Credit Risk:** Trader financial health, payment history
   - **Logistics Risk:** Transport, storage, delivery challenges
   - **FX Risk:** Currency fluctuation exposure
   - **Compliance Risk:** Regulatory, EUDR, sanctions
   - **Counterparty Risk:** Buyer reliability
3. Add qualitative justification (notes)
4. System calculates **Total Risk Score** (weighted average)

**Risk Bands:**
- **Low (0-30):** Deal Officer can approve directly
- **Medium (31-60):** Deal Officer can approve (CEO notified)
- **High (61-100):** **Must escalate to CEO** for approval

**What Happens:**
- **API:** `POST /api/trades/[id]/risk`
- **Database:**
  - New/updated row in `trade_risk_scores`:
    - Individual dimension scores
    - `total_score` (calculated)
    - `qualitative_notes`
  - `trades.risk_score` → updated

**If High Risk:**
- **API:** `POST /api/trades/[id]/escalate` (creates `ceo_escalations` row)
- **Notification:** CEO gets alert: "High-risk trade requires your approval"
- CEO reviews, then either:
  - Approves → trade advances
  - Declines → trade marked as `REJECTED` (terminal state)

**If Approved:**
- Deal Officer clicks "Send to Finance Partner"
- **API:** `PATCH /api/trades/[id]` with `{ stage: 'FINANCE_REVIEW' }`

---

### Stage 4: FINANCE_REVIEW

#### Actor: Deal Officer
**Screen:** Trade Operations → Click on trade → FDP Tab  
**Action:**
1. Click "Generate Finance Data Package"
2. System compiles:
   - Trade details
   - Risk score breakdown
   - Trader profile (past performance, KYC status)
   - Buyer profile (payment history)
   - Market analysis
   - Validation checklist results
   - Recommended terms (interest rate, tenor)
3. Review/edit FDP
4. Click "Send to Finance Partner"
5. Select FP from dropdown (or assign new FP)

**What Happens:**
- **API:**
  - `POST /api/trades/[id]/fdp` → generates FDP (stored as JSON)
  - `PATCH /api/trades/[id]` → sets `fp_org_id`, keeps stage as `FINANCE_REVIEW`
- **Database:**
  - New row in `finance_data_packages` (trade_id, content, sent_at)
  - `trades.fp_org_id` → assigned FP
- **Notification:**
  - Finance Partner gets email/notification: "New deal for review: [trade_ref]"

---

#### Actor: Finance Partner
**Screen:** Finance Partner Portal → Pending Requests  
**Action:**
1. Click on trade to review FDP
2. Review all details:
   - Trade structure
   - Risk assessment
   - Trader background
   - Buyer creditworthiness
   - Proposed terms
3. Make decision:
   - **Approve:** Accept facility, confirm terms
   - **Decline:** Reject with reason
   - **Request Revision:** Ask for better terms/more equity

**What Happens:**
- **API:** `POST /api/trades/[id]/fp-decision` (not yet built in Next.js — see CLEANUP_AND_BUILD_PLAN.md)
- **Database:**
  - New row in `fp_decisions`:
    - `decision`: `APPROVED`, `DECLINED`, `REVISION_REQUESTED`
    - `approved_amount_usd`
    - `interest_rate_pct`
    - `notes`
- **If Approved:**
  - `PATCH /api/trades/[id]` → `{ stage: 'FUNDED' }`
- **If Declined:**
  - Trade remains `FINANCE_REVIEW`, Deal Officer notified

---

### Stage 5: FUNDED

#### Actor: Deal Officer + Finance Team
**Screen:** Trade Operations → Click on trade → Deployment Tab  
**Action:**
1. FP transfers capital to escrow account (manual banking operation)
2. Once confirmed, Deal Officer records capital deployment in batches:
   - Batch 1: 60% released to trader (initial procurement)
   - Batch 2: 40% released later (as commodity verified)
3. For each batch:
   - Amount
   - Date
   - Purpose/notes
   - Upload bank transfer proof

**What Happens:**
- **API:** `POST /api/trades/[id]/deployment-batch` (not yet built — see plan)
- **Database:**
  - New row in `deployment_batches` for each release:
    - `batch_number`, `amount_usd`, `deployed_at`, `purpose`, `proof_doc_id`
  - `trades.capital_deployed_pct` → updated (e.g., 60%, then 100%)

**When Capital Deployed:**
- Deal Officer clicks "Confirm Procurement Started"
- **API:** `PATCH /api/trades/[id]` → `{ stage: 'PROCURING' }`

---

### Stage 6: PROCURING

#### Actor: Trader + Deal Officer
**Screen:** Trader Portal → Trade Details → Logistics  
**Action:**
1. Trader procures commodity from aggregators/farmers
2. As shipments happen, trader uploads:
   - Bill of Lading
   - Quality Certificate
   - Warehouse Receipt
   - Photos of commodity
3. Deal Officer reviews each shipment
4. When all commodity delivered to port/warehouse:
   - Deal Officer clicks "Confirm Delivery Complete"

**What Happens:**
- **API:**
  - `POST /api/trades/[id]/documents` (for each logistics doc)
  - `POST /api/trades/[id]/shipment` (not yet built — see plan)
- **Database:**
  - Docs → `trade_documents` (doc_type: `BILL_OF_LADING`, etc.)
  - New rows in `shipment_records`:
    - `shipment_date`, `carrier`, `tracking_number`, `delivery_confirmed_at`
  - `trades.stage` → `DELIVERED`

---

### Stage 7: DELIVERED

#### Actor: CFO (or CEO)
**Screen:** Trade Operations → Click on trade → Settlement Tab  
**Action:**
1. Buyer pays offtaker (trader receives payment)
2. Trader uploads proof of buyer payment:
   - Bank statement showing wire
   - Payment confirmation letter
3. CFO reviews payment confirmation
4. CFO calculates **waterfall settlement**:
   - Total received from buyer
   - **Finance Partner repayment** (principal + return) — paid first
   - **Miziba fee** (platform fee)
   - **Trader residual** (what's left after FP + fee)
5. CFO approves settlement instruction
6. Finance team executes payments (manual banking)
7. CFO uploads payment confirmations
8. CFO clicks "Settlement Complete"

**What Happens:**
- **API:** `POST /api/trades/[id]/settlement` (exists but UI incomplete)
- **Database:**
  - New row in `waterfall_instructions`:
    - `buyer_payment_usd`, `fp_principal_usd`, `fp_return_usd`, `miziba_fee_usd`, `trader_residual_usd`
    - `cfo_approved_by`, `cfo_approved_at`
    - `settled_at` (when payments confirmed)
  - `trades.stage` → `SETTLED`
- **Notification:**
  - Trader: "Settlement complete, residual paid"
  - Finance Partner: "Settlement complete, principal + return paid"

---

### Stage 8: SETTLED

#### Actor: Deal Officer or CEO
**Screen:** Trade Operations → Click on trade → Closure Tab  
**Action:**
1. Review **Closure Checklist** (7 items):
   - ☐ Waterfall confirmed
   - ☐ Trade Report received (TRR)
   - ☐ Commodity Completion Certificate received (CCC)
   - ☐ Buyer performance recorded
   - ☐ Trader record updated (performance, volume, value)
   - ☐ FP report sent (settlement summary)
   - ☐ Record locked (final archive)
2. Complete each item:
   - Upload final documents
   - Record metrics
   - Generate reports
3. When all complete, click "Close Trade"

**What Happens:**
- **API:** `PATCH /api/trades/[id]` → `{ stage: 'CLOSED' }`
- **Database:**
  - `trade_closure_checklists` → all checkboxes `true`
  - `trade_closure_checklists.record_locked` → `true`
  - `trade_closure_checklists.locked_at` → timestamp
  - `trades.stage` → `CLOSED`
  - **Database trigger** prevents further edits to trade

---

### Stage 9: CLOSED (Terminal State)

**Properties:**
- Trade is read-only
- Cannot be reopened or edited
- Available for reporting and analytics only
- All documents archived

---

## 3. User Management Workflows

### Invite New User

**Actor:** Ops Admin or CEO  
**Screen:** Admin Dashboard → User Management → Add User  
**Flow:** See Trader Onboarding Step 1 above

**Supported Roles:**
- `trader` → Creates trader org + trader profile
- `finance_partner` → Creates FP org + FP profile
- `deal_officer`, `cfo`, `ceo`, `ops_admin` → Creates internal staff (Miziba org)

---

### Reset User Password

**Actor:** Ops Admin  
**Screen:** Admin Dashboard → User Directory → Click user → Reset Password  
**Action:**
1. Click "Reset Password"
2. System generates new temporary password
3. Sets `must_change_password` → `true`
4. Admin shares temp password with user (manual/email)

**API:** Not yet built as dedicated route — currently done via direct DB update or re-invite

---

### Unlock Locked Account

**Actor:** Ops Admin  
**Screen:** Admin Dashboard → User Directory → Click user → Unlock Account  
**Action:**
1. User locked after 5 failed login attempts
2. Admin clicks "Unlock Account"

**What Happens:**
- **API:** `POST /api/admin/users/unlock`
- **Database:**
  - `users.locked_until` → `null`
  - `users.failed_logins` → `0`

---

### Reset User 2FA

**Actor:** Ops Admin  
**Screen:** Admin Dashboard → User Directory → Click user → Reset 2FA  
**Action:**
1. User lost access to authenticator app
2. Admin clicks "Reset 2FA"

**What Happens:**
- **API:** `POST /api/admin/users/reset-mfa`
- **Database:**
  - `users.totp_enabled` → `false`
  - `users.totp_secret` → `null`
  - `users.mfa_enrolled_at` → `null`
- User must re-enroll 2FA on next login

---

## 4. Notification Flows

### Notification Types

| Event | Recipients | Trigger |
|---|---|---|
| New trade submitted | Deal Officer, CEO, Ops Admin | `POST /api/trades` |
| Trader KYC submitted | CEO, Ops Admin, Deal Officer (info only) | `POST /api/trader/onboard` |
| High-risk trade escalation | CEO | Risk score > 60 |
| FDP sent to FP | Finance Partner | `POST /api/trades/[id]/fdp` |
| FP decision made | Deal Officer, CEO | `POST /api/trades/[id]/fp-decision` |
| Settlement complete | Trader, FP | `trades.stage` → `SETTLED` |

**Delivery:**
- In-app notification badge (stored in `notifications` table)
- Email (future — currently manual)

---

## 5. Document Upload Flows

### Trade Documents

**Actors:** Trader, Deal Officer  
**API:** `POST /api/trades/[id]/documents`  
**Storage:** Supabase Storage bucket `miziba-tradeaxis-docs/trades/`  
**Database:** `trade_documents` table

**Document Types:**
- Purchase Order
- Export License
- Bill of Lading
- Quality Certificate
- Warehouse Receipt
- Payment Confirmation
- Settlement Report

**Permissions:**
- Traders can upload to their own trades
- Deal Officers can upload to any trade
- Documents can be locked (immutable) after specific stages

---

### KYC Documents

**Actor:** Trader  
**API:** `POST /api/trader/documents`  
**Storage:** Supabase Storage bucket `miziba-tradeaxis-docs/kyc/`  
**Database:** `organisation_documents` table

**Required Document Types:**
- Certificate of Incorporation
- Tax Clearance Certificate
- Bank Statement (last 3 months)
- Export License
- Business Registration

**Status Flow:**
```
UPLOADED → UNDER_REVIEW → VERIFIED/REJECTED
```

---

## 6. Data Visibility Rules (RBAC)

### Traders
- **Can see:** Only their own trades, their own documents, their own notifications
- **Can create:** New trade applications, upload documents to their trades
- **Cannot see:** Other traders' data, internal risk scores, FP details, settlement details

### Deal Officers
- **Can see:** All trades, all trader profiles, buyer data, portfolio metrics
- **Can create:** Validation records, risk scores, FDPs, deployment batches
- **Can update:** Trade stages, assign FPs, request documents
- **Cannot:** Create users, modify system config, approve settlements (CFO only)

### CEO
- **Can see:** Everything
- **Can do:** Everything Deal Officer can do + approve high-risk escalations + create users + view audit logs

### CFO
- **Can see:** All trades, financial data, settlement records
- **Can do:** Approve waterfall settlements, dual-sign large payments
- **Limited:** Cannot advance trade stages (Deal Officer responsibility)

### Finance Partners
- **Can see:** Only trades assigned to them (stage = `FINANCE_REVIEW` or `fp_org_id` = their org)
- **Can create:** FP decisions (approve/decline)
- **Cannot see:** Internal risk calculations, other FPs' data, trader banking details

### Ops Admin
- **Can see:** All users, organizations, system logs, webhook events
- **Can do:** Create users, **approve/reject trader KYC**, unlock accounts, reset 2FA, monitor system health
- **Cannot:** Approve trades, score risk, advance trade stages (not their workflow)

### Deal Officer
- **Can see:** All trades, validation checklists, risk calculations, buyer database
- **Can do:** Advance trade stages, validate trades, score risk, generate FDPs, assign FPs
- **Cannot:** **Approve/reject trader KYC** (CEO/Ops Admin only), approve settlements, create users

---

## 7. Reporting & Analytics (Future)

### Available Data

- **Trade Portfolio:** Total value, volume, by commodity, by stage
- **Trader Performance:** Completion rate, average deal size, payment timeliness
- **Buyer Intelligence:** Payment history, volumes, sectors
- **Finance Partner Health:** Capital deployed, returns, risk appetite
- **Platform Metrics:** Trades per month, approval rates, average cycle time

**Current State:** Data exists in DB, reporting UI not yet built (see CLEANUP_AND_BUILD_PLAN.md Phase 4)

---

## 8. Edge Cases & Error Handling

### What if Trader Never Completes KYC?
- Account exists but cannot submit trades
- Admin can manually set `kyc_status` to `VERIFIED` if offline verification done

### What if FP Declines Multiple Times?
- Deal Officer can assign different FP
- Or adjust deal terms and re-send to same FP
- Or mark trade as `WITHDRAWN` (manual status change)

### What if Buyer Doesn't Pay?
- CFO does not advance to `SETTLED`
- Non-payment protocol: Manual escalation, demand letters (see `non_payment_protocols` table)
- Trade remains stuck at `DELIVERED` until resolved

### What if Deal Officer Leaves Mid-Deal?
- CEO or another Deal Officer can reassign `deal_officer_id` on trade
- All history preserved in `audit_log` and `trade_stage_log`

---

## 9. Manual Operations (Not Automated)

These are **outside the system** and require human coordination:

1. **Banking operations:** Capital transfers, settlement payments (future: integrate with bank APIs)
2. **Email notifications:** Currently manual; future: integrate with SendGrid/Resend
3. **PDF generation:** FDPs currently JSON; future: render as PDF
4. **Logistics tracking:** Manual document upload; future: integrate TrackGuard webhooks
5. **Document signing:** Manual/offline; future: integrate DocuSign

---

## Summary: Key Takeaways

- **Trades** flow through 9 stages, each with specific actor responsibilities
- **Traders** onboard once (KYC), then submit trades repeatedly
- **Validation** is a manual 5-point checklist by Deal Officers
- **Risk scoring** determines approval path (direct vs CEO escalation)
- **Finance Partners** review FDPs and make fund/decline decisions
- **Settlement** follows a **waterfall**: FP paid first, then Miziba fee, then trader residual
- **Closure** is a 7-point checklist that locks the trade record permanently

**Next:** See `CLEANUP_AND_BUILD_PLAN.md` for missing UI components to complete these workflows.
