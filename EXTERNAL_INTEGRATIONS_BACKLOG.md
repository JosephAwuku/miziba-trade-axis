# External Integrations Backlog

**Status:** Future / optional. **Not in use.** TradeAxis today runs on **manual workflows** and **Next.js + Supabase** only. None of the services below are built or required for core operations.

This document preserves draft integration ideas (**TrackGuard**, **TradeVault**, etc.) if the product later adds automatic webhooks and third-party systems.

---

## 1. TradeVault (Escrow & Waterfall)

### Webhook Specification
- **Endpoint**: `/api/webhooks/tradevault`
- **Method**: `POST`
- **Auth**: HMAC-SHA256 (Shared Secret)

### Required Event Handlers
| Event Type | Logic to Trigger | Manual Override Counterpart |
| :--- | :--- | :--- |
| `escrow.funded` | Move trade from `FUNDED` to `PROCURING` | Deal Officer: "Confirm Equity Deposit" |
| `payment.confirmed` | Update `deployment_batches` and Recalculate Health | Deal Officer: Manual batch entry |
| `waterfall.settled` | Advance trade to `SETTLED` | CFO: "Confirm Settlement Success" |

---

## 2. TrackGuard (Logistics & GPS)

### Webhook Specification
- **Endpoint**: `/api/webhooks/trackguard`
- **Method**: `POST`
- **Auth**: HMAC-SHA256 (Shared Secret)

### Required Event Handlers
| Event Type | Logic to Trigger | Manual Override Counterpart |
| :--- | :--- | :--- |
| `shipment.created` | Generate `trackguard_id` and ETA | Deal Officer: Link Shipment ID |
| `shipment.in_transit`| Update GPS coordinates on Monitor | Manual GPS coordinate updates |
| `shipment.delivered`| Move trade from `PROCURING` to `DELIVERED` | Deal Officer: "Mark as Delivered" |

---

## 3. Automated User Onboarding (Email)

### Integration Scope
Currently, user creation is manual and temporary passwords (`Welcome123!`) must be shared out-of-band. The goal is to automate this using **Resend** or a similar SMTP/Transactional email provider.

### Feature Workflow
1.  **Trigger**: On `POST /api/admin/invite` success.
2.  **Action**:
    -   Generate a secure, single-use invitation token or random temporary password.
    -   Dispatch a branded HTML email to the invitee.
    -   Include a direct "Magic Link" or "Set Password" URL.
3.  **Authentication**: Transition from custom JWT login to **Supabase Auth** or a secure email-based verification flow.

### Required Templates
| Email Type | Purpose | Key Data |
| :--- | :--- | :--- |
| `Invite (Trader)` | Verification & Onboarding | Org Name, Temporary Credentials |
| `Invite (Partner)` | Facility Management Access | Finance Portfolio Link |
| `Password Reset` | Security recovery | Reset Token Link |

---

## 4. Finance Partner Onboarding Enforcement

### Current Status
Onboarding is currently a "soft" checklist in Standalone Mode. Users can see and approve deals even if they haven't completed the framework agreement or bank setup.

### Required Hardening
1.  **Block Decisions**: In `FinancePartnerPortal`, disable or hide the "Pending Requests" view and "Approve" buttons if `onboarding_done` is `FALSE` (or `onboarding_step < 6`).
2.  **Synchronize State**: Sync the `onboardingStep` state from the frontend to the `finance_partner_profiles` table in Supabase.
3.  **DocuSign Integration**: Wire Step 2 (Master Framework Agreement) to a real DocuSign flow (see backlog item #3).
4.  **Backend Guard**: Update `validateStageTransition()` in the backend business logic to require an "Onboarded Partner" flag before allowing `FINANCE_REVIEW` -> `FUNDED` transition.

---

## Technical Debt / Next Steps for "Integrated Mode"

1.  **Remove Override Guards**: When switching to Integrated Mode, the "Manual Override" buttons in the UI should be hidden or locked behind an "Emergency Admin" role only.
2.  **Signature Verification**: Implement HMAC verification in a Next.js route handler if/when webhooks are added. (Legacy Express reference code was removed from the repo.)
3.  **Real-Time Subscriptions**: Ensure Supabase Real-time is enabled on the `webhook_events` table for observability.

> [!NOTE]
> Webhook handlers are not shipped in this repo. Design them alongside new `app/api/webhooks/*` routes when integrations are approved.
