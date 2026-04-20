# TradeAxis Test Credentials

Use these email addresses to access different role-based dashboards in the development environment.

## Test Email Accounts
Any password will work for these test accounts during the development phase.

| Role | Email Address | Dashboard / Access |
| :--- | :--- | :--- |
| **Deal Officer** | `officer@miziba.com` | Pipeline, validation & deal advancement |
| **Head of Trade / CEO** | `ceo@miziba.com` | Full dashboard + CEO approval authority |
| **CFO** | `cfo@miziba.com` | Settlement & waterfall authorisation |
| **Trader** | `trader@miziba.com` | Application, tracking & document upload |
| **Finance Partner** | `partner@miziba.com` | Deal review, facility approval & portfolio |
| **Ops Admin** | `admin@miziba.com` | System configuration & administrative tasks |

## Notes
- These mappings are hardcoded in `components/Login.tsx` for testing purposes.
- For real accounts, the system will use Supabase Auth and fetch roles from the `users` table.
