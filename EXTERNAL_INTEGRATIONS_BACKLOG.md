# External Integrations Backlog

This document preserves the technical specifications and integration nodes for **TrackGuard** and **TradeVault**. Use this as a reference when transitioning from the currently implemented "Standalone Mode" to "Fully Integrated Mode."

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

## Technical Debt / Next Steps for "Integrated Mode"

1.  **Remove Override Guards**: When switching to Integrated Mode, the "Manual Override" buttons in the UI should be hidden or locked behind an "Emergency Admin" role only.
2.  **Signature Verification**: The signature validation code in `tradeaxis-backend/core/webhook-processor.js` needs to be ported to a Next.js middleware.
3.  **Real-Time Subscriptions**: Ensure Supabase Real-time is enabled on the `webhook_events` table for observability.

> [!NOTE]
> All business logic handlers for these events are currently stored in `tradeaxis-backend/core/webhook-processor.js`.
