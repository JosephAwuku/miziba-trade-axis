# Trade Workflow Implementation

## Overview

This document describes the implemented trade workflow system with complete guardrails and validation checks. **No bypasses are allowed** - all staff must follow the prescribed workflow.

## Complete Trade Stage Flow

```
SUBMITTED → UNDER_VALIDATION → VALIDATED → FINANCE_REVIEW → FUNDED → 
PROCURING → DELIVERED → SETTLED → CLOSED
```

## Stage-by-Stage Requirements

### 1. SUBMITTED → UNDER_VALIDATION

**Who Can Advance:** Deal Officer, CEO

**Requirements:**
- None (Deal Officer can start validation anytime)

**API Endpoint:** `PATCH /api/trades/[id]` with `stage: 'UNDER_VALIDATION'`

**What Happens:**
- Trade moves to validation phase
- Validation checklist becomes active

---

### 2. UNDER_VALIDATION → VALIDATED

**Who Can Advance:** Automatic when all validation items complete

**Requirements:**
- ✅ All 5 validation items must be checked:
  - `buyer_verified` = true
  - `price_reasonable` = true
  - `sourcing_feasible` = true
  - `trader_qualified` = true
  - `margin_viable` = true

**API Endpoint:** `PATCH /api/trades/[id]/validation`

**Database Check:**
```sql
SELECT buyer_verified, price_reasonable, sourcing_feasible, 
       trader_qualified, margin_viable
FROM trade_validations
WHERE trade_id = $1
```

**What Happens:**
- When the last validation item is checked, the trade automatically advances to VALIDATED
- `trades.validated_at` timestamp is set
- Notifications sent to relevant parties

**How to Check Items:**
```json
PATCH /api/trades/[id]/validation
{
  "item_id": "buyer_verified",
  "completed": true,
  "notes": "Buyer verified through WorldCheck"
}
```

---

### 3. VALIDATED → FINANCE_REVIEW

**Who Can Advance:** Deal Officer, CEO (after completing risk scoring)

**Requirements:**
- ✅ Risk score must be recorded in `trade_risk_scores` table
- ✅ If risk score < 55 (high risk): CEO must approve via `ceo_escalations` table with `decision = 'approve_direct'`
- ✅ If risk score >= 55 (low/moderate risk): Can proceed directly

**API Endpoint:** `POST /api/trades/[id]/fdp` (generates FDP and advances stage)

**Database Checks:**
```sql
-- Check risk score exists
SELECT total_score FROM trade_risk_scores WHERE trade_id = $1

-- If score < 55, check CEO approval
SELECT decision FROM ceo_escalations 
WHERE trade_id = $1 AND decision = 'approve_direct'
```

**How to Record Risk:**
```json
POST /api/trades/[id]/risk
{
  "risk_score": 45,
  "breakdown": {
    "buyer_risk": 10,
    "trader_risk": 8,
    "commodity_price_risk": 12,
    "sourcing_supply_risk": 8,
    "logistics_delivery_risk": 7
  },
  "notes": "High risk due to new trader"
}
```

**CEO Approval (if needed):**
```json
POST /api/trades/[id]/ceo-decision
{
  "decision": "approve_direct",
  "notes": "Approved despite high risk - trader has strong track record"
}
```

**What Happens:**
- If high risk without CEO approval: FDP generates but stage does NOT advance
- If approved or low/moderate risk: Trade advances to FINANCE_REVIEW
- FP is notified to review the deal

---

### 4. FINANCE_REVIEW → FUNDED

**Who Can Advance:** Finance Partner decision (automatically advances when approved)

**Requirements:**
- ✅ Finance Partner must create approval record in `fp_decisions` table with `decision = 'approve'`

**API Endpoint:** `POST /api/trades/[id]/fp-decision`

**Database Check:**
```sql
SELECT decision FROM fp_decisions 
WHERE trade_id = $1 AND decision = 'approve'
ORDER BY decided_at DESC LIMIT 1
```

**How FP Approves:**
```json
POST /api/trades/[id]/fp-decision
{
  "decision": "approve",
  "notes": "Terms acceptable. Proceeding with funding."
}
```

**What Happens:**
- Trade automatically advances to FUNDED
- `trades.funded_at` timestamp is set
- Trader and Deal Officers notified

**FP Can Also:**
- Decline: `{"decision": "decline", "notes": "Risk too high"}`
- Request info: `{"decision": "info_request", "info_request": "Need updated financials"}`

---

### 5. FUNDED → PROCURING

**Who Can Advance:** Deal Officer, CEO, CFO

**Requirements:**
- ✅ Capital deployed must be >= 60% (`trades.capital_deployed_pct >= 60`)

**API Endpoint:** `PATCH /api/trades/[id]` with `stage: 'PROCURING'`

**Database Check:**
```sql
SELECT capital_deployed_pct FROM trades WHERE id = $1
-- Must be >= 60
```

**How to Update Deployment:**
```json
PATCH /api/trades/[id]/deployment
{
  "capital_deployed_pct": 60
}
```

**What Happens:**
- Trade advances to procurement phase
- Trader can begin commodity sourcing
- Logistics documents can be uploaded

---

### 6. PROCURING → DELIVERED

**Who Can Advance:** Deal Officer, CEO

**Requirements:**
- ✅ Delivered weight must be recorded (`trades.delivered_weight_mt > 0`)

**API Endpoint:** `PATCH /api/trades/[id]` with `stage: 'DELIVERED'`

**Database Check:**
```sql
SELECT delivered_weight_mt FROM trades WHERE id = $1
-- Must be > 0
```

**How to Confirm Delivery:**
```json
PATCH /api/trades/[id]/delivery
{
  "delivered_weight_mt": 125.5,
  "volume_procured_mt": 125.5,
  "grade_a_pct": 85,
  "grade_b_pct": 12,
  "grade_c_pct": 3
}
```

**What Happens:**
- Trade advances to DELIVERED
- `trades.delivered_at` timestamp is set
- Weight variance is automatically calculated
- Notifications sent to CFO to begin settlement

---

### 7. DELIVERED → SETTLED

**Who Can Advance:** CFO, CEO (via dual approval signature)

**Requirements:**
- ✅ Buyer payment must be recorded (`trades.buyer_payment_usd > 0`)
- ✅ Waterfall instruction must exist with CFO approval (`waterfall_instructions.cfo_approved_at` is set)
- ✅ Dual CFO signature (two CFOs must sign)

**API Endpoint:** Settlement process has multiple steps

**Database Checks:**
```sql
-- Check buyer payment
SELECT buyer_payment_usd FROM trades WHERE id = $1

-- Check waterfall approved
SELECT cfo_approved_at FROM waterfall_instructions WHERE trade_id = $1
```

**Settlement Process:**

1. **Initiate Settlement:**
```json
POST /api/trades/[id]/settlement
{
  "action": "initiate"
}
```

2. **Record Buyer Payment:**
```json
POST /api/trades/[id]/settlement
{
  "action": "record_payment",
  "payment_amount": 174000,
  "payment_date": "2026-05-10"
}
```

3. **First CFO Signs:**
```json
POST /api/trades/[id]/settlement
{
  "action": "sign"
}
```

4. **Second CFO Signs:**
```json
POST /api/trades/[id]/settlement
{
  "action": "sign"
}
```

**What Happens:**
- After both CFO signatures: Trade automatically advances to SETTLED
- `trades.settled_at` timestamp is set
- Waterfall status changes to 'INSTRUCTED'
- All parties notified about settlement completion

---

### 8. SETTLED → CLOSED

**Who Can Advance:** Deal Officer, CEO (after closure checklist complete)

**Requirements:**
- ✅ All 7 closure checklist items must be complete:
  - `waterfall_confirmed` = true
  - `trr_received` = true (Trade Report Received)
  - `ccc_received` = true (Commodity Completion Certificate)
  - `buyer_perf_recorded` = true
  - `trader_rec_updated` = true
  - `fp_report_sent` = true
  - `record_locked` = true

**API Endpoint:** `PATCH /api/trades/[id]/closure`

**Database Check:**
```sql
SELECT waterfall_confirmed, trr_received, ccc_received, 
       buyer_perf_recorded, trader_rec_updated, 
       fp_report_sent, record_locked
FROM trade_closure_checklists
WHERE trade_id = $1
-- All must be true
```

**How to Complete Checklist:**
```json
PATCH /api/trades/[id]/closure
{
  "waterfall_confirmed": true,
  "trr_received": true,
  "ccc_received": true,
  "buyer_perf_recorded": true,
  "trader_rec_updated": true,
  "fp_report_sent": true,
  "record_locked": true
}
```

**What Happens:**
- When `record_locked` is set to true AND all other items complete: Trade automatically advances to CLOSED
- `trades.closed_at` timestamp is set
- `trade_closure_checklists.locked_at` timestamp is set
- Trade becomes immutable (read-only)
- Final notifications sent

---

### 9. CLOSED (Terminal State)

**Properties:**
- Trade is read-only
- Cannot be edited or reopened
- Stage transitions are blocked
- Available for reporting and analytics only

---

## Role-Based Permissions

### Deal Officer
- Can advance: SUBMITTED → UNDER_VALIDATION
- Can complete: All validation items
- Can score: Risk assessment
- Can confirm: Delivery, Deployment updates
- Can update: Closure checklist
- **Cannot:** Approve FP decisions, Sign waterfall

### CEO
- Can do: Everything Deal Officer can do
- Can approve: High-risk escalations
- Can sign: Waterfall settlements
- Can advance: All stages (except FP-controlled stages)
- **Cannot:** Bypass validation requirements

### CFO
- Can update: Capital deployment
- Can record: Buyer payments
- Can sign: Waterfall settlements (dual approval)
- **Cannot:** Advance trade stages, Complete validation

### Finance Partner
- Can view: Only assigned trades
- Can make: Approve/Decline decisions
- **Cannot:** See other FPs' trades, Bypass approval requirements

### Trader
- Can view: Only own trades
- Can submit: New trade applications
- Can upload: Documents
- **Cannot:** Advance stages, See internal risk scores

### Ops Admin
- Can view: All trades, users, organizations
- Can manage: User accounts, KYC approvals
- **Cannot:** Advance trade stages (not their workflow)

---

## Key Business Rules (ENFORCED)

1. **Sequential Stages Only**: Cannot skip stages (e.g., cannot go from SUBMITTED to FUNDED)

2. **No Backdating**: All timestamps are system-generated

3. **Immutable Closure**: CLOSED trades cannot be reopened or modified

4. **Mandatory Risk Scoring**: Cannot advance to FINANCE_REVIEW without risk assessment

5. **High-Risk Gate**: Risk score < 55 requires CEO approval before Finance Review

6. **FP Approval Gate**: Cannot advance to FUNDED without FP approval

7. **Dual CFO Approval**: Settlement requires two different CFO signatures

8. **Minimum Capital Deployment**: 60% capital must be deployed before procurement

9. **Delivery Confirmation**: Physical delivery must be recorded before settlement

10. **Complete Closure Checklist**: All 7 items must be complete before closure

---

## Error Messages

If a stage transition is blocked, the API returns:

```json
{
  "error": "INVALID_TRANSITION",
  "message": "Specific reason why transition is blocked",
  "stage": "proposed_stage",
  "guards": {
    "validationComplete": false,
    "riskScored": true,
    // ... other guard values
  }
}
```

This helps users understand exactly what's missing.

---

## API Summary

| Endpoint | Purpose | Required Role |
|----------|---------|---------------|
| `PATCH /api/trades/[id]` | Advance trade stage | Internal (with guards) |
| `PATCH /api/trades/[id]/validation` | Update validation item | Deal Officer, CEO |
| `POST /api/trades/[id]/risk` | Record risk score | Deal Officer, CEO |
| `POST /api/trades/[id]/ceo-decision` | CEO approve/decline | CEO only |
| `POST /api/trades/[id]/fdp` | Generate FDP & advance | Deal Officer, CEO |
| `POST /api/trades/[id]/fp-decision` | FP approve/decline | Finance Partner only |
| `PATCH /api/trades/[id]/deployment` | Update capital % | Deal Officer, CEO, CFO |
| `PATCH /api/trades/[id]/delivery` | Confirm delivery | Deal Officer, CEO |
| `POST /api/trades/[id]/settlement` | Settlement actions | CFO, CEO |
| `PATCH /api/trades/[id]/closure` | Update closure checklist | Deal Officer, CEO |

---

## Database Validation Functions

The `checkStageTransitionGuards()` function in `lib/business-logic.ts` queries the database to verify all requirements before allowing stage transitions. This function is called by the trade update endpoint and returns actual boolean values based on database state.

**No hardcoded bypasses exist in the codebase.**

---

## Testing the Workflow

To test each stage transition:

1. Create a new trade (SUBMITTED)
2. Start validation (→ UNDER_VALIDATION)
3. Complete all 5 validation items (→ VALIDATED automatically)
4. Record risk score
   - If high risk: CEO must approve
5. Generate FDP (→ FINANCE_REVIEW if approved)
6. FP approves (→ FUNDED automatically)
7. Deploy 60%+ capital
8. Advance to PROCURING
9. Confirm delivery (→ DELIVERED)
10. Record buyer payment
11. Dual CFO sign waterfall (→ SETTLED automatically)
12. Complete all 7 closure items
13. Lock record (→ CLOSED automatically)

Each step must be completed in order. Attempting to skip will result in an error.

---

## Audit Trail

All stage transitions are logged via `auditLog()` function, which records:
- User who performed the action
- Timestamp
- Old and new values
- Trade ID and entity type

This creates a complete audit trail for compliance and troubleshooting.
