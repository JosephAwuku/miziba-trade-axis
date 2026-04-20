# TRADEAXIS — PRODUCTION BUILD PLAN
Miziba Infrastructure Ltd | Module 4
Target: Production-ready in 10 sprints (20 weeks)

---

## DEVELOPER BRIEF

**Who you need:** One senior full-stack developer (Node.js + PostgreSQL + React/Vue).
Ghana market rate: $2,500–$5,000/month.
All architecture decisions, schemas, API contracts, and business logic are pre-specified.
Developer role: assembly, configuration, testing. Not design.

**What is pre-built and ready to use:**
- `schema.sql` — run this first. Full PostgreSQL schema with triggers.
- `core/business-logic.js` — waterfall engine, risk calculator, stage machine, FDP assembler, deployment health checker, non-payment protocol, closure validator, notification triggers.
- `core/rbac.js` — permissions matrix, middleware, audit logger.
- `core/webhook-processor.js` — full TradeVault and TrackGuard event handlers.
- `openapi.yaml` — every API endpoint, request/response schema.
- `infrastructure.md` — full AWS provisioning spec.

**Developer builds:**
- Express.js routing layer (wire openapi.yaml endpoints to logic)
- PostgreSQL query layer (service functions using schema.sql)
- React/HTML dashboard (reference TradeAxis_v2_Complete.html prototype)
- PDF generation worker (Puppeteer + SQS)
- Notification worker (SQS + SES)
- DocuSign integration
- Staging + production deployment

---

## SPRINT PLAN

### SPRINT 1 — Weeks 1–2: Foundation
**Goal:** Running server, database, authentication.

**Tasks:**
- [ ] Provision AWS infrastructure (RDS, ECS, S3, SQS, Redis, ALB)
- [ ] Apply `schema.sql` to RDS instance
- [ ] Scaffold Express.js project structure
- [ ] Implement `POST /auth/login` and `GET /auth/me`
- [ ] JWT + session middleware (`core/rbac.js` — `authenticate()`)
- [ ] `requirePermission()` middleware wired to all route files
- [ ] `GET /health` endpoint
- [ ] Seed Miziba organisation + first CEO user
- [ ] Deploy to staging
- [ ] Smoke test: login, get user, logout

**CEO review:** Confirm role-login flow works for all 5 roles.

**Deliverable:** Authenticated API running on staging.

---

### SPRINT 2 — Weeks 3–4: Trade Lifecycle Core
**Goal:** Full trade CRUD + stage machine.

**Tasks:**
- [ ] `POST /trades` — trader application submission (equity ≥35% validation)
- [ ] `GET /trades` — list with role-scoped filtering (trader sees own, FP sees assigned)
- [ ] `GET /trades/:id` — full trade detail with ownership check
- [ ] `PATCH /trades/:id/stage` — stage advance using `validateStageTransition()`
- [ ] `POST /trades/:id/decline` — decline with reason log + notification queue
- [ ] Auto-generate `trade_ref` (BR-YYYY-NNNN trigger)
- [ ] Stage transition audit log (`trade_stage_log`)
- [ ] `auditLog()` called on every state change
- [ ] Unit tests for business-logic.js (waterfall, risk, stage machine)

**CEO review:** Test full trade submission as trader. Advance through stages as deal_officer.

**Deliverable:** Trade lifecycle working end-to-end on staging.

---

### SPRINT 3 — Weeks 5–6: Validation + Risk + Escalation
**Goal:** Complete validation workflow including CEO escalation.

**Tasks:**
- [ ] `GET/PATCH /trades/:id/validation` — checklist update
- [ ] `POST /trades/:id/escalate` — CEO escalation
- [ ] `POST /trades/:id/escalation/decision` — CEO decision
- [ ] `GET/PUT /trades/:id/risk` — risk scoring using `calculateRiskScore()`
- [ ] `POST /risk/calculator` — preview calculator
- [ ] Risk score saved to `trade_risk_scores`
- [ ] Trader risk history updated on each scored trade (`trader_risk_history`)
- [ ] `calcTraderRiskScore()` called after each trade settles to update `trader_profiles`
- [ ] CEO notifications for escalations wired to SQS

**CEO review:** Walk through escalation flow. Confirm CEO receives notification and decision is logged.

**Deliverable:** Validation + risk scoring complete. CEO escalation functional.

---

### SPRINT 4 — Weeks 7–8: Finance Data Package + FP Portal
**Goal:** FDP generation, FP decision workflow, term sheet.

**Tasks:**
- [ ] `POST /trades/:id/fdp` — generate FDP using `assembleFDP()`
- [ ] `POST /trades/:id/fdp/send` — queue notification to FP
- [ ] `GET /trades/:id/fdp/pdf` — pre-signed S3 URL
- [ ] PDF generation worker (SQS consumer, Puppeteer, upload to S3)
- [ ] `POST /trades/:id/fp-decision` — FP approve/decline/info_request
- [ ] Term sheet draft auto-generated on FP approval
- [ ] `GET/PUT /trades/:id/risk` available to FP (read-only)
- [ ] Finance partner portal scoped views (inbox shows FINANCE_REVIEW only)
- [ ] Farmer ID anonymisation in batch responses for FP role

**CEO review:** Test as finance_partner: review FDP, approve, receive term sheet.

**Deliverable:** Finance partner workflow end-to-end. FDP PDF generating to S3.

---

### SPRINT 5 — Weeks 9–10: Capital Deployment + Logistics
**Goal:** Deployment dashboard + TrackGuard integration layer.

**Tasks:**
- [ ] `GET/PATCH /trades/:id/deployment` — deployment dashboard API
- [ ] `GET/POST /trades/:id/batches` — farmer payment batch log
- [ ] `PATCH /trades/:id/deployment` — manual update in standalone mode
- [ ] TrackGuard webhook endpoint (`POST /webhooks/trackguard`)
- [ ] Wire all TrackGuard handlers from `webhook-processor.js`
- [ ] `GET /trades/:id/logistics` — logistics summary panel
- [ ] `GET /trades/:id/logistics/alerts` — alert feed
- [ ] EUDR + Grade A health checks from `checkDeploymentHealth()`
- [ ] CRITICAL alert notifications to deal_officer + CEO

**CEO review:** Simulate delivery event via webhook. Confirm trade advances to DELIVERED automatically.

**Deliverable:** Deployment tracking + logistics integration functional.

---

### SPRINT 6 — Weeks 11–12: TradeVault Integration + Settlement
**Goal:** Waterfall settlement engine + CFO portal + non-payment protocol.

**Tasks:**
- [ ] TradeVault webhook endpoint (`POST /webhooks/tradevault`)
- [ ] Wire all TradeVault handlers from `webhook-processor.js`
- [ ] `instructTradeVaultWaterfall()` outbound call from CFO confirmation
- [ ] `GET/POST /trades/:id/settlement` — CFO settlement confirmation
- [ ] Waterfall calculation using `calculateWaterfall()` — logged to `waterfall_instructions`
- [ ] Non-payment protocol: `GET/POST /trades/:id/non-payment`
- [ ] Non-payment escalation steps wired
- [ ] Waterfall order enforcement (FP first) — DB constraint + application layer
- [ ] CFO-only permission on `settlement.confirm`

**CEO review:** Simulate buyer payment. Confirm waterfall splits. Test non-payment escalation to Step 3.

**Deliverable:** Settlement engine live. TradeVault integration tested.

---

### SPRINT 7 — Weeks 13–14: Documents + Closure + DocuSign
**Goal:** Full document management + trade closure + term sheet signing.

**Tasks:**
- [ ] `GET /trades/:id/documents` — document list
- [ ] `POST /trades/:id/documents` — pre-signed S3 upload URL
- [ ] `GET /trades/:id/documents/:doc_id` — pre-signed S3 download URL
- [ ] Document access logged to `document_access_log`
- [ ] 7-year expiry set via DB trigger (already in schema)
- [ ] Document locking on CLOSED trades
- [ ] `GET/PATCH /trades/:id/closure` — closure checklist
- [ ] `POST /trades/:id/closure/lock` — lock trade record (requires 7/7 checklist)
- [ ] DocuSign integration: create envelope, webhook for `envelope.completed`
- [ ] Executed term sheet stored in S3 + document record updated

**CEO review:** Complete full closure checklist. Lock a trade. Confirm record is immutable.

**Deliverable:** Document management + closure workflow complete. DocuSign functional.

---

### SPRINT 8 — Weeks 15–16: Portfolio + Notifications + Dashboard
**Goal:** Portfolio dashboard, buyer DB, FP CRM, notifications live.

**Tasks:**
- [ ] `GET /portfolio` — metrics from cache or computed query
- [ ] Portfolio metrics cache refresh job (every 5 minutes via cron)
- [ ] `GET /portfolio/buyers` — buyer creditworthiness database
- [ ] `GET /portfolio/finance-partners` — FP CRM
- [ ] `GET /portfolio/risk-evolution/:trader_org_id` — risk history chart data
- [ ] Notification worker: SQS consumer → SES email dispatch
- [ ] In-app notifications: `GET /notifications` + `POST /notifications/:id/read`
- [ ] All notification triggers from `getNotificationsForEvent()` wired at service layer
- [ ] FP onboarding status tracking in `finance_partner_profiles`
- [ ] Admin endpoints: `POST /admin/organisations`, `POST /admin/users`

**CEO review:** Review full portfolio dashboard. Check buyer DB populates after trade settlement.

**Deliverable:** Portfolio + notifications fully operational.

---

### SPRINT 9 — Weeks 17–18: Dashboard UI Integration
**Goal:** Wire React/HTML dashboard to production API.

**Tasks:**
- [ ] Replace all mock data in TradeAxis_v2_Complete.html with API calls
- [ ] Auth flow: login page → JWT stored in httpOnly cookie
- [ ] All role-based views wired to live data
- [ ] Real-time updates: WebSocket or polling (every 30s) for pipeline and deployment
- [ ] FDP PDF download from S3 pre-signed URL
- [ ] Document upload flow wired to pre-signed S3 upload URLs
- [ ] Error handling + loading states
- [ ] Mobile responsiveness confirmed
- [ ] Deploy to S3 + CloudFront

**CEO review:** Full walkthrough of all 5 roles in production environment.

**Deliverable:** Live dashboard connected to production API.

---

### SPRINT 10 — Weeks 19–20: Testing, Load Testing, Launch
**Goal:** Production-ready. CEO sign-off. Go live.

**Tasks:**
- [ ] End-to-end integration test: full trade from SUBMITTED → CLOSED
- [ ] Load test: 20 concurrent FP portal sessions (per NFR)
- [ ] Load test: p95 API latency < 400ms under load
- [ ] Security review: OWASP Top 10 checklist
- [ ] Penetration test: at minimum, automated scan (OWASP ZAP)
- [ ] Backup + restore drill: confirm DR procedure works
- [ ] Finance partner UAT: Ecobank Relationship Manager tests FP portal
- [ ] Trader UAT: JNI AGRI tests trader portal
- [ ] CEO sign-off on: validation flow, risk scoring, FDP, waterfall, closure
- [ ] Production DNS cutover
- [ ] Monitoring alarms confirmed active
- [ ] Runbook written for on-call developer

**CEO review:** Final sign-off. Trade 1 run through system live.

**Deliverable:** TradeAxis in production. First live trade processed.

---

## MILESTONE SUMMARY

| Milestone | Week | Deliverable |
|-----------|------|-------------|
| M1 | 2 | Auth + database running |
| M2 | 4 | Trade lifecycle operational |
| M3 | 6 | Validation + risk scoring |
| M4 | 8 | FDP + Finance partner portal |
| M5 | 10 | Deployment + logistics |
| M6 | 12 | Settlement + waterfall |
| M7 | 14 | Documents + closure + DocuSign |
| M8 | 16 | Portfolio + notifications |
| M9 | 18 | Dashboard UI live |
| **M10** | **20** | **Production launch** |

---

## BUDGET ESTIMATE

| Item | Cost |
|------|------|
| 1 Senior developer, 5 months | $12,500–$25,000 |
| AWS infrastructure (launch) | ~$1,150 (5 months) |
| DocuSign sandbox + production | ~$1,250 (5 months) |
| Legal review of term sheet template | $3,000–$8,000 (one-time) |
| **Total** | **~$18,000–$35,000** |

*Lower end = Ghanaian developer at local rate. Upper end = diaspora/international developer.*

---

## WHAT THE DEVELOPER DOES NOT NEED TO DESIGN

Everything that a typical senior developer would spend weeks designing has already been specified:

- Database schema (all tables, indexes, constraints, triggers) → `schema.sql`
- All business rules (waterfall, risk, stage, FDP, health checks) → `core/business-logic.js`
- All permissions and access control → `core/rbac.js`
- All webhook handling logic → `core/webhook-processor.js`
- All API endpoints, request/response schemas → `openapi.yaml`
- Full infrastructure spec → `infrastructure.md`
- UI/UX prototype → `TradeAxis_v2_Complete.html`

Developer time is spent on: wiring, configuration, testing, and deployment. Not architecture.
