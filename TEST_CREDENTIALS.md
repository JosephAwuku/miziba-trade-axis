# TradeAxis v2.0 Test Credentials

Use these credentials to access different role-based dashboards. **The development login bypass has been disabled**, so these accounts now authenticate against the real Supabase database.

## Active Test Accounts
All test accounts currently share a unified password for development convenience.

**Password for all accounts:** `TradeAxis2026!`

| Role | Email Address | Dashboard / Access |
| :--- | :--- | :--- |
| **Ops Admin** | `admin@miziba.com` | System configuration, User Management & Admin tasks |
| **Head of Trade / CEO** | `ceo@miziba.com` | Strategic Command Center + Approval authority |
| **Finance Officer** | `cfo@miziba.com` | Settlement authorization, liquidity oversight & funded-facility monitoring |
| **Trader** | `trader@miziba.com` | Trade Applications, Tracking & Document upload |
| **Deal Officer** | `officer@miziba.com` | Trade Operations, Validation & Deal advancement |
| **Finance Partner** | `partner@miziba.com` | External lender: Facility approval, deal review & partner portfolio |

## Important Notes
- **Persistence**: All data entered while logged into these accounts is persisted to the live database.
- **New Accounts**: You can create additional users via the **User Management Hub** (accessible as Ops Admin or CEO).
- **Session Security**: If you encounter a "Session Stale" or "JWT Malformed" error, please log out and log back in to refresh your secure token.
- **RBAC**: Access to specific API endpoints is strictly governed by the `lib/rbac.ts` permissions matrix.
