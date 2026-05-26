# TradeAxis Supabase + Vercel Migration Plan

## Purpose

This document captures the recommended migration plan for converting TradeAxis into a full-stack Next.js application using Supabase and Vercel.

## Scope Sources

Use these files as the project scope reference:
- `tradeaxis-backend/README.md` — what remains under `tradeaxis-backend/` (SQL + OpenAPI reference only).
- `tradeaxis-backend/openapi.yaml` — historical REST contract (Express-era); cross-check when adding `app/api` routes.
- `tradeaxis-backend/schema.sql` — PostgreSQL database model.
- `lib/business-logic.ts`, `lib/rbac.ts` — live TypeScript business rules and permissions.

## Recommended Stack

- Frontend + API: Next.js (App Router)
- Database + Auth + Storage: Supabase
- Deployment + serverless functions: Vercel
- Email: Resend or Supabase-compatible email provider
- Background jobs / scheduling: Vercel Cron or serverless functions
- Shared types: TypeScript across frontend and API

## Migration Phases

### Phase 0 — Confirm Scope

1. Review `tradeaxis-backend/openapi.yaml` (reference) and `TRADEAXIS_SYSTEM_OVERVIEW.md`.
2. Confirm MVP flows:
   - auth
   - trade submission and pipeline
   - validation
   - risk scoring
   - FDP generation
   - finance partner review
   - settlement/waterfall
   - documents and trade closure

### Phase 1 — Consolidate into a single Next.js repo

1. Keep the existing `tradeaxis/` workspace as the single repository.
2. Move backend business logic into reusable TypeScript modules.
3. Create shared models in `lib/types.ts`.
4. Plan API routes under `app/api/`.

### Phase 2 — Set up Supabase

1. Create a Supabase project.
2. Import `tradeaxis-backend/schema.sql` into Supabase Postgres.
3. Configure Supabase Auth:
   - email/password login
   - optional 2FA for privileged users
4. Configure Supabase Storage for documents and FDP PDFs.
5. Add Supabase role policies for each user type.

### Phase 3 — Replace backend DB and auth layer

1. Use Supabase client in `lib/supabaseClient.ts` or equivalent.
2. Convert custom auth routes to Supabase login/logout/session.
3. Replace Redis/session persistence with Supabase session handling.
4. Use Supabase storage for pre-signed document upload/download.

### Phase 4 — Migrate API endpoints

1. Add or extend route handlers under `app/api/` as needed (the legacy Express server under `tradeaxis-backend/src` was removed).
2. Keep `lib/business-logic.ts` and `lib/rbac.ts` as the source of truth for rules.
3. Use `openapi.yaml` only as a **reference** when naming endpoints or payloads.
4. Keep API route handlers serverless-friendly.

### Phase 5 — Migrate frontend to real API

1. Replace mock data in `lib/data.ts` with live fetches.
2. Implement login and token/session flows.
3. Build role-based pages for actual trade workflows.
4. Connect forms and actions to API routes.

### Phase 6 — Background jobs and async workflows

1. Replace SQS worker model with Vercel Cron or serverless functions.
2. Implement PDF generation jobs.
3. Implement notification dispatch jobs.
4. Use Supabase Realtime for live updates where useful.

### Phase 7 — Deploy to Vercel

1. Connect repository to Vercel.
2. Add Supabase environment variables.
3. Deploy frontend and API routes.
4. Configure Vercel scheduled functions for cron jobs.

### Phase 8 — Test and verify

1. Validate every role flow end-to-end.
2. Confirm role-based access and Supabase policies.
3. Test complete trade lifecycle.
4. Verify the system matches the scope defined in sprint plan and API contract.

## Expected Benefits

- Fewer moving parts than separate Express backend.
- Full TypeScript type safety across frontend and API.
- Simpler auth and storage through Supabase.
- Vercel-native deployment for front-end and API routes.
- Easier development and lower ops overhead.

## Notes

- AWS services can still be used if needed, but the recommended path is to replace S3/stored files with Supabase Storage and manage scheduling through Vercel.
- The current backend files are the authoritative scope documents for this migration.
- This plan is intentionally modular: core trade workflows first, then advanced features like DocuSign and webhooks.
