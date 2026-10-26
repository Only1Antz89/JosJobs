# Athena Corporate Operations Portal

## Product Intent

Athena needs a dedicated internal operations portal layered on top of the existing two-sided platform:

- client side for organisations posting assignments
- field team side for operators taking assignments
- admin side for Athena staff managing operations, finance, onboarding, reporting, and communications

Phase 1 in this repo is a production-oriented scaffold:

- desktop-first admin shell and route structure
- cached server-rendered admin pages
- demo-backed query layer derived from the current marketplace seed data
- authenticated route handlers prepared for privileged admin operations
- validation schemas for core create flows

## Implemented Route Map

### App routes

- `/admin`
- `/admin/clients`
- `/admin/clients/[clientId]`
- `/admin/operators`
- `/admin/operators/[operatorId]`
- `/admin/assignments`
- `/admin/assignments/[assignmentId]`
- `/admin/finance`
- `/admin/onboarding`
- `/admin/communications`
- `/admin/communications/campaigns`
- `/admin/communications/campaigns/new`
- `/admin/communications/campaigns/[campaignId]`
- `/admin/reports`
- `/admin/settings`
- `/admin/audit-log`
- `/admin-login`

### API routes

- `GET /api/admin/dashboard`
- `GET /api/admin/clients`
- `GET /api/admin/clients/:clientId`
- `POST /api/admin/clients`
- `GET /api/admin/operators`
- `GET /api/admin/operators/:operatorId`
- `POST /api/admin/operators`
- `GET /api/admin/assignments`
- `GET /api/admin/assignments/:assignmentId`
- `GET /api/admin/finance`
- `GET /api/admin/onboarding`
- `GET /api/admin/campaigns`
- `POST /api/admin/campaigns`
- `GET /api/admin/exports`
- `POST /api/admin/exports`
- `GET /api/admin/audit-log`

## Data Strategy

The current marketplace domain in this repo still speaks in `organiser` and `staff` terms. The admin portal adds a presentation layer that maps those concepts into the Athena business language:

- organisers become clients
- staff become operators
- jobs become assignments

The portal currently uses `lib/queries/admin-dataset.ts` to:

- derive admin KPIs from the existing demo seed
- compute client spend and balances
- compute operator rankings and performance summaries
- produce onboarding, campaign, export, and audit records
- populate list and detail views without mutating the existing public app

## Live-Wiring Plan

To move from demo scaffold to live admin operations:

1. Provision the SQL objects in [`supabase/athena-admin-schema.sql`](../supabase/athena-admin-schema.sql).
2. Back `requireAdmin()` with `admin_users` records in Supabase Auth.
3. Replace demo query builders with service-role server queries or admin-safe RPCs.
4. Wire POST routes to server actions or route handlers that:
   - validate with the existing Zod schemas
   - write to Supabase using a privileged server client
   - append `audit_logs` entries for sensitive actions
5. Move export and campaign delivery to background-safe execution paths.

## Recommended Next Build Steps

- Add TanStack Table for interactive server-driven filters on the main list screens.
- Replace the CSS chart placeholders with Recharts once live aggregates are available.
- Add materialized views for dashboard KPIs and rankings.
- Implement finance reminder, onboarding approval, and assignment replacement server actions.
- Add RBAC-aware UI gating per admin role on settings, finance, and communications surfaces.
