# TradeAxis Cleanup & Build Plan
**Goal:** Single working system (Next.js + Supabase) with complete manual workflows

---

## Phase 1: Remove Unused Backend (Security & Clarity) — **DONE**

The following were removed from the repo:

- `tradeaxis-backend/src/` (Express app)
- `tradeaxis-backend/core/` (duplicate JS + webhook processor)
- `tradeaxis-backend/__tests__/`
- `Dockerfile`, `docker-compose.yml`, `package.json`, `infrastructure.md`, `sprint-plan.md`, `.github/workflows/`

### Kept (reference)

- `tradeaxis-backend/schema.sql`
- `tradeaxis-backend/migrations/`
- `tradeaxis-backend/openapi.yaml`
- `tradeaxis-backend/README.md`

### Docs updated

- `EXTERNAL_INTEGRATIONS_BACKLOG.md`, `SUPABASE_MIGRATION_PLAN.md`, `TRADEAXIS_SYSTEM_OVERVIEW.md`

### Optional (not done unless you ask)

- Root `README.md` still default Next.js text — say the word if you want a real project README.

---

## Phase 2: Fix Core Data Issues (partially done in codebase)

### 2.1 Session Duration Consistency — **DONE**

JWT expiry for full sessions uses `SESSION_EXPIRY_MINUTES` (default **60**). Set in env to match your policy.

### 2.2 Role Naming Standardization — **DONE**

`fp` removed from `Role` type and UI; admin invite allows `ops_admin`; use `finance_partner` everywhere.

### 2.3 Trade Creation — **DONE**

`POST /api/trades` inserts `trade_closure_checklists` after `trade_validations`.

### 2.4 Money Display Consistency

**Still optional:** audit UI formatting when you touch money views.

---

## Phase 3: Complete Manual Workflow UI

### 3.1 Deal Officer Stage Controls

**Missing UI:** Deal Officer needs buttons to advance trade through stages after manual verification

**Create:** `components/views/StageTransitionPanel.tsx`

**Features:**
- Show current stage and next possible stage
- Stage-specific requirements:
  - `VALIDATED` → `FINANCE_REVIEW`: Risk scored, all validations checked
  - `FINANCE_REVIEW` → awaits FP decision (no DO action)
  - `FUNDED` → `PROCURING`: FP approved, capital deployment recorded
  - `PROCURING` → `DELIVERED`: Shipment docs uploaded and verified
  - `DELIVERED` → `SETTLED`: Buyer payment confirmed, waterfall calculated
  - `SETTLED` → `CLOSED`: Closure checklist complete

**Where:** Add to `components/views/DealDetail.tsx` (only visible to Deal Officer, CEO)

**API:** Already exists - `PATCH /api/trades/[id]` with `{ stage: 'NEW_STAGE' }`

---

### 3.2 Finance Partner Decision Form

**Missing UI:** FP needs a form to approve/decline a deal

**Create:** `components/views/FinancePartnerDecisionPanel.tsx`

**Fields:**
- Decision: Approve / Decline
- Approved amount (if different from requested)
- Interest rate / return percentage
- Notes
- Document upload (term sheet, approval memo)

**API:** Already exists - `POST /api/trades/[tradeId]/fp-decision`

**Where:** Add to `components/views/DealDetail.tsx` (only visible when stage = `FINANCE_REVIEW` and user is FP)

---

### 3.3 CFO Waterfall Approval

**Missing UI:** CFO needs to approve settlement before funds are released

**Create:** `components/views/WaterfallApprovalPanel.tsx`

**Show:**
- Buyer payment amount (verified)
- FP principal repayment
- FP return
- Miziba fee
- Trader residual
- Total reconciliation

**Actions:**
- Approve settlement
- Request revision
- Add CFO notes

**API:** Use existing `POST /api/trades/[id]/settlement`

**Where:** Add to `components/views/DealDetail.tsx` (visible when stage = `DELIVERED` and user is CFO or CEO)

---

### 3.4 Capital Deployment Tracker

**Missing UI:** Track when and how much capital is released to trader

**Create:** `components/views/DeploymentBatchForm.tsx`

**Fields:**
- Batch number
- Amount released
- Date
- Purpose (e.g., "Initial 60% for procurement")
- Supporting document upload

**API:** Create `POST /api/trades/[id]/deployment-batch`

**Database:** Insert into `deployment_batches` table (already exists in schema)

**Where:** Add to `components/views/DealDetail.tsx` (visible when stage = `PROCURING`, role = Deal Officer or CEO)

---

### 3.5 Shipment Confirmation

**Missing UI:** Confirm goods have been shipped and delivered

**Create:** `components/views/ShipmentRecordForm.tsx`

**Fields:**
- Shipment date
- Carrier / tracking number
- Bill of lading upload
- Quality certificate upload
- Delivery confirmation date
- Notes

**API:** Create `POST /api/trades/[id]/shipment`

**Database:** Insert into `shipment_records` table

**Where:** Add to `components/views/DealDetail.tsx` (visible when stage = `PROCURING`, role = Deal Officer, Trader, or CEO)

---

### 3.6 Closure Checklist UI

**Missing UI:** Final sign-off before closing trade

**Update:** `components/views/DealDetail.tsx` to show closure checklist

**Show:** Five checklist items from `trade_closure_checklists`:
- All documents filed ✓
- Regulatory compliance confirmed ✓
- Final settlement confirmed ✓
- Trader confirmation received ✓
- Finance Partner confirmation received ✓

**Action:** "Mark Complete" button for CEO/CFO
**When all checked:** Enable "Close Trade" button

**API:** Already exists - `PATCH /api/trades/[id]` with `{ stage: 'CLOSED' }`

---

## Phase 4: Complete Trader Portal

### 4.1 Trader Dashboard Enhancement

**File:** `components/views/TraderPortal.tsx`

**Add:**
- Current applications status
- Documents required (by stage)
- Upload prompts with clear instructions
- Communication thread with Deal Officer (or notification history)

### 4.2 Trader Document Upload

**File:** `components/trader/TraderDocuments.tsx`

**Improve:**
- Show required vs optional docs
- Show doc status (pending review, approved, rejected)
- Allow re-upload if rejected
- Clear labeling (e.g., "Purchase Order", "Export License", "Bank Statement")

**API:** Already exists - `POST /api/trades/[id]/documents`

---

## Phase 5: Complete Finance Partner Portal

### 5.1 FP Dashboard

**File:** `components/views/FinancePartnerPortal.tsx`

**Show:**
- Deals pending FP review (stage = `FINANCE_REVIEW`)
- Deals funded by this FP (with performance tracking)
- Total capital deployed
- Expected returns
- Settled deals (with actual returns)

### 5.2 FP Deal Review

**Add to:** `components/views/DealDetail.tsx` (FP view)

**Show:**
- Full FDP (Finance Data Package)
- Risk score breakdown
- Validation checklist results
- Trader profile and history
- Buyer profile and payment history
- Recommended deal terms

**Action:** Finance Partner Decision Form (from Phase 3.2)

---

## Phase 6: Admin & Operations Hardening

### 6.1 User Verification Workflow

**File:** `components/admin/VerificationInBox.tsx`

**Enhance:**
- Show all uploaded KYC documents
- Checklist for verification (ID verified, company registered, bank account confirmed)
- Approve / Reject with notes
- Email notification on approval (or manual notification prompt)

**API:** Already exists - `POST /api/admin/verify`

### 6.2 Audit Log Viewer

**Create:** `components/admin/AuditLogViewer.tsx`

**Features:**
- Filter by user, action type, date range
- Search by trade ID or entity
- Export to CSV

**API:** Already exists - `GET /api/admin/dashboard` returns audit logs (expand if needed)

### 6.3 System Health Dashboard

**File:** `app/page.tsx` (Admin Ops Dashboard)

**Add:**
- Active users count
- Trades by stage (chart)
- Webhook failures (already shown)
- System errors in last 24h (from logs)

---

## Phase 7: Polish & Production Prep

### 7.1 Error Handling
- Add error boundaries to all major components
- Toast notifications for success/failure
- Retry logic for failed API calls

### 7.2 Loading States
- Skeleton loaders for all data fetches
- Progress indicators for long operations (FDP generation, etc.)

### 7.3 Responsive Design
- Test all forms and dashboards on mobile/tablet
- Ensure tables are scrollable on small screens

### 7.4 Permissions Audit
- Review `lib/rbac.ts` against actual usage
- Ensure no role can access another role's data
- Test with each role login

### 7.5 Documentation
- Update `README.md` with setup instructions
- Add API route documentation (or generate from JSDoc)
- Create user manual for each role

---

## Files to Create (Summary)

### New API Routes
- `app/api/trades/[id]/deployment-batch/route.ts`
- `app/api/trades/[id]/shipment/route.ts`
- `app/api/trades/[id]/fp-decision/route.ts` (may already exist - verify)

### New UI Components
- `components/views/StageTransitionPanel.tsx`
- `components/views/FinancePartnerDecisionPanel.tsx`
- `components/views/WaterfallApprovalPanel.tsx`
- `components/views/DeploymentBatchForm.tsx`
- `components/views/ShipmentRecordForm.tsx`
- `components/admin/AuditLogViewer.tsx`

### Updated Components
- `components/views/DealDetail.tsx` (integrate all new panels)
- `components/views/TraderPortal.tsx` (enhance dashboard)
- `components/views/FinancePartnerPortal.tsx` (complete review flow)
- `components/admin/VerificationInBox.tsx` (add checklist)

---

## Testing Checklist

### Per Role
- [ ] Trader: Submit trade, upload docs, view status
- [ ] Deal Officer: Validate trade, score risk, generate FDP, advance stages
- [ ] CEO: Review escalations, approve high-risk deals
- [ ] CFO: Approve waterfall settlement
- [ ] Finance Partner: Review FDP, approve/decline deal, track funded deals
- [ ] Ops Admin: Invite users, verify KYC, monitor system

### Full Trade Lifecycle
- [ ] Trade submitted → under validation
- [ ] Validation complete → validated
- [ ] FDP generated → finance review
- [ ] FP approves → funded
- [ ] Capital deployed → procuring
- [ ] Shipment confirmed → delivered
- [ ] Waterfall approved → settled
- [ ] Closure checklist complete → closed

---

## Priority Order (What to Build First)

### High Priority (Core Operations)
1. Fix trade creation (add closure checklist row)
2. Stage transition panel for Deal Officer
3. Finance Partner decision form
4. Shipment confirmation form
5. CFO waterfall approval

### Medium Priority (Portal Completion)
6. Trader dashboard enhancement
7. FP dashboard and deal review
8. Capital deployment tracker
9. Admin verification checklist

### Low Priority (Polish)
10. Audit log viewer
11. System health charts
12. Documentation updates
13. Error handling improvements

---

## Next Step

Would you like me to start with Phase 1 (removing the unused Express backend) or jump straight to Phase 3 (building the missing manual workflow UI)?
