# TradeAxis — database reference only

This folder keeps **schema and migrations** for the TradeAxis Postgres model. The runnable API is **Next.js** (`app/api/*`) against Supabase — not an Express server here.

- **`schema.sql`** — table definitions (source of truth for the domain model).
- **`migrations/`** — incremental SQL applied in order.
- **`openapi.yaml`** — historical REST contract from the original Express design. **Not served by the current app**; use as a reference when adding or documenting `app/api` routes.

Do not reintroduce server code in this directory without an explicit decision to split deployments again.
