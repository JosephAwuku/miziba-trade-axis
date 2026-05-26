# TradeAxis System Overview

## What TradeAxis Is

**TradeAxis** is a **commodity trade-finance platform** built for **Miziba Infrastructure Ltd**. The core business is this:

Traders in Ghana source and export agricultural commodities (cashew, shea, sesame, sorghum, soya). They need financing to do it — to buy the goods before they get paid by buyers. TradeAxis is the internal software that manages the **entire lifecycle** of those financed deals, from a trader submitting an application all the way to the final settlement and profit split.

This is an **internal operations tool**, not a public-facing product.

---

## The Six User Roles

| Role | Who they are | What they do |
|---|---|---|
| **Trader** | The commodity exporter/agent | Submits trade applications, tracks deal status, manages documents and logistics |
| **Deal Officer** | Internal deal desk analyst | Reviews and validates submitted trades, scores risk, generates Finance Data Packages (FDPs) to show finance partners |
| **CEO** | Top decision maker at Miziba | Approves/declines escalated trades, makes final calls on high-risk deals, oversees everything |
| **CFO** | Finance controller at Miziba | Handles settlement instructions and waterfall payment sign-off (dual-approval required in some cases) |
| **Finance Partner (FP)** | An external investor/lender | Reviews FDPs, decides whether to fund a deal, tracks the trades they've funded |
| **Ops Admin** | Internal system administrator | Creates/manages users, onboards organisations, monitors system health, handles verifications |

---

## Trade Lifecycle (Manual Workflow)

```
SUBMITTED → UNDER_VALIDATION → VALIDATED → FINANCE_REVIEW → FUNDED → PROCURING → DELIVERED → SETTLED → CLOSED
```

### Stage-by-Stage Flow

1. **SUBMITTED** (Trader action)
   - Trader fills out trade application (commodity, volume, price, buyer, equity split)
   - Documents uploaded (purchase order, export license, etc.)
   - Trade enters system

2. **UNDER_VALIDATION** (Deal Officer action)
   - Deal Officer reviews five checklist items:
     - Price reasonable
     - Sourcing feasible
     - Buyer verified
     - Trader qualified
     - Margin viable
   - Reviews uploaded documents
   - Can request additional documents from trader

3. **VALIDATED** (Deal Officer or CEO action)
   - Risk is scored across dimensions (market, credit, logistics, FX, compliance, counterparty)
   - High-risk trades escalated to CEO for approval
   - Low/medium-risk can be approved by Deal Officer
   - If approved → advances to FINANCE_REVIEW

4. **FINANCE_REVIEW** (Deal Officer action)
   - Deal Officer generates Finance Data Package (FDP) - essentially a pitch deck for the investor
   - FDP sent to Finance Partner manually (email, portal link, etc.)

5. **FUNDED** (Finance Partner action)
   - Finance Partner reviews FDP
   - Makes fund/decline decision in the system
   - If approved → capital commitment recorded
   - Trade advances to FUNDED

6. **PROCURING** (Deal Officer / Trader coordination)
   - Capital deployed in batches as needed
   - Trader procures commodity
   - Logistics tracked manually (shipping docs, quality certs uploaded)
   - When shipment complete and confirmed → advances to DELIVERED

7. **DELIVERED** (Finance / Deal Officer action)
   - Buyer payment confirmed (bank statement, wire confirmation)
   - Waterfall settlement calculated:
     - Finance Partner paid first (principal + return)
     - Miziba fee taken
     - Trader receives residual
   - CFO approves settlement instruction (dual approval if configured)

8. **SETTLED** (Deal Officer / CEO action)
   - Payment confirmation documents uploaded
   - Closure checklist completed (all docs filed, fees paid, compliance confirmed)
   - Trade locked and archived

9. **CLOSED** (Final state)
   - Trade record is read-only
   - Cannot be edited or reopened

---

## Current Architecture (As of May 2026)

### Active Stack
- **Frontend:** Next.js 15 (App Router)
- **Database:** PostgreSQL via Supabase
- **Auth:** Custom JWT + TOTP (bcrypt password hash)
- **API Layer:** Next.js API Routes (`/api/*`)
- **Hosting:** Local dev (intended for Vercel production)

### What Exists and Works
- ✅ Login, 2FA onboarding, password management
- ✅ Trade list and creation
- ✅ Deal detail page (validation, risk, documents, timeline)
- ✅ Admin dashboard (pending verifications, audit logs)
- ✅ User management (invite, KYC verification, account unlock)
- ✅ Notifications system
- ✅ Role-based UI and permissions (RBAC)
- ✅ Risk calculator (deal-specific scoring)

### What Is Incomplete
- ⚠️ Settlement / waterfall flow (UI exists, needs completion)
- ⚠️ Finance Partner portal (needs hardening)
- ⚠️ Trader self-service portal (needs polish)
- ⚠️ Portfolio metrics (needs real data volume)
- ⚠️ FDP generation (needs PDF pipeline or manual template)

### What Is NOT Being Built (External Systems)
- ❌ TradeVault (document vault - will be manual upload for now)
- ❌ TrackGuard (logistics tracking - will be manual shipment updates)
- ❌ DocuSign integration (signatures - will be manual/offline)
- ❌ Automatic webhooks and stage transitions
- ❌ Separate microservices (TradeVault, TrackGuard, etc.) — **not built**; operations are **manual** for now

---

## Database Schema (Core Tables)

### Identity & Access
- `users` - all system users (traders, staff, FPs)
- `organisations` - trader companies, finance partners, buyers, Miziba entity
- `sessions` - active login sessions
- `trader_profiles` - extended trader company data
- `finance_partner_profiles` - FP onboarding and health data

### Trade Core
- `trades` - the main trade record (one row per deal)
- `buyers` - buyer/counterparty master data
- `trade_validations` - five-point checklist per trade
- `trade_risk_scores` - dimensional risk scores
- `ceo_escalations` - high-risk escalations to CEO

### Deal Lifecycle
- `finance_data_packages` - FDP generation metadata
- `fp_decisions` - fund/decline decisions from FPs
- `term_sheets` - legal terms (future)
- `deployment_batches` - capital deployment tranches
- `shipment_records` - logistics/delivery tracking
- `waterfall_instructions` - settlement payment orders
- `trade_closure_checklists` - final sign-off items

### Supporting
- `trade_documents` - uploaded files
- `notifications` - user alerts
- `audit_log` - system activity trail
- `webhook_events` - (for future use)
- `system_config` - global settings

---

## Known Issues & Cleanup Needed

### 1. `tradeaxis-backend/` folder (SQL + reference only)

**Status:** The **Express server, workers, and duplicate JS** (`src/`, `core/`) have been **removed**. Only **`schema.sql`**, **`migrations/`**, **`openapi.yaml`** (reference), **`README.md`**, and a minimal **`.env.example`** remain.

**Action needed:** None for removal. Continue to evolve the domain model via migrations and `lib/*.ts`.

### 2. Integration backlog

**Files:** `EXTERNAL_INTEGRATIONS_BACKLOG.md` (future TradeVault / TrackGuard ideas — **not required** for operations today).

**Action needed:** Treat as optional future work; workflows stay **manual** until product says otherwise.

### 3. Remaining code drift

- ~~Session duration mismatch~~ — JWT duration now follows `SESSION_EXPIRY_MINUTES` (default **60**), aligned with the sessions model.
- ~~Role alias `fp`~~ — use **`finance_partner`** only in types and UI checks.
- "Miziba" vs "Mizaba" typos — fix opportunistically in code you touch.

**Action needed:** Standardize naming as you work on affected files.

### 4. Missing Manual Workflow Features
- No UI for Deal Officer to manually mark "DELIVERED" after reviewing shipment docs
- No clear CFO waterfall approval flow in UI
- No Finance Partner decision input form (exists in API, not in UI)
- No batch deployment input form for tracking capital releases

---

## Next Steps for Production Readiness

### Phase 1: Clean Up (Remove Dead Code)
1. ~~Remove Express server under `tradeaxis-backend/`~~ **Done** — only `schema.sql`, `migrations/`, `openapi.yaml`, `README.md` remain.
2. Update all docs to reflect Next.js-only architecture — **In progress / see repo docs**
3. Treat external integrations as optional — **See `EXTERNAL_INTEGRATIONS_BACKLOG.md`**
4. ~~Standardize session JWT duration and role naming~~ — **Done** (`SESSION_EXPIRY_MINUTES`, `finance_partner` only)

### Phase 2: Complete Manual Workflows
1. Build Deal Officer stage transition controls (DELIVERED, SETTLED buttons with document requirements)
2. Build CFO settlement approval form
3. Build Finance Partner decision input form
4. Build capital deployment batch tracker
5. Add document upload prompts at each stage gate

### Phase 3: Harden Multi-Role Experience
1. Complete Trader portal with application status and document uploads
2. Complete Finance Partner portal with their funded deals only
3. Add role-specific dashboards for CEO/CFO
4. Improve notifications for stage transitions

### Phase 4: Admin & Ops Tools
1. Complete user verification workflows
2. Add audit trail viewer
3. Add system health monitoring
4. Add data export for reporting

---

## Security Notes

- Passwords hashed with bcrypt
- TOTP 2FA enforced after first login
- Row-level security (RLS) policies in Supabase (see `migrations/0004_enable_rls.sql`)
- JWT tokens with 8h expiry (consider shortening for production)
- Role-based access control via `lib/rbac.ts`

**Cleanup needed:**
- Remove unused Express auth code
- Audit Supabase admin client usage (bypasses RLS - ensure only used in trusted API routes)
- Add rate limiting to public routes (login, invite)

---

## File Structure Reference

```
tradeaxis/
├── app/
│   ├── page.tsx              # Main SPA shell
│   ├── globals.css           # Styles
│   └── api/                  # All backend routes (Next.js API)
│       ├── auth/
│       ├── trades/
│       ├── admin/
│       ├── portfolio/
│       └── notifications/
├── components/
│   ├── admin/                # Admin-specific UI
│   ├── views/                # Role-specific dashboards
│   ├── trader/               # Trader portal components
│   └── [shared components]
├── lib/
│   ├── api.ts                # Frontend API client
│   ├── rbac.ts               # Permissions matrix
│   ├── auth-session.ts       # JWT session length (SESSION_EXPIRY_MINUTES)
│   ├── business-logic.ts     # Waterfall, risk bands, stage rules
│   ├── supabase.ts           # DB client setup
│   └── types.ts              # TypeScript types
├── tradeaxis-backend/        # schema.sql, migrations/, openapi.yaml (reference only)
└── [docs]
```

---

## Contact & Maintenance

This document reflects the system state as of **May 2026**.

For questions about:
- Business logic: see `lib/business-logic.ts` and `schema.sql` comments
- Permissions: see `lib/rbac.ts`
- API routes: see `app/api/` and inline JSDoc
- Database schema: see `tradeaxis-backend/schema.sql` and migrations

**Maintainer note:** This system is designed for manual operations with human decision points. Do not build automatic stage transitions or external integrations without explicit business approval and testing.
