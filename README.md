# Athena Pro Platform

Athena Pro is a production-minded event operations platform for ticketing support, field team deployment, and commercial event oversight. It is built with `Next.js 14`, `TypeScript`, `Tailwind CSS`, and `Supabase`, with a fallback demo runtime that keeps the app interactive when Supabase is not configured.

## What's Included

- Premium public site for Athena Pro marketing, services, about, and enquiry flow
- Platform access, client workspace, and field-team workspace
- Event creation, assignment publishing, deployment request, and review flows
- Bayesian-weighted field-team ranking
- Supabase SQL for schema, RLS policies, views, and seed data
- Demo-mode local auth and browser-persisted seed data

## Tech Approach

- `app/`: App Router routes and API handlers
- `components/`: shared UI and layout building blocks
- `features/`: route-facing modules and workflow orchestration
- `lib/domain/`: ranking and transition logic
- `lib/data/`: live and demo providers plus store utilities
- `lib/services/`: server-safe public data services
- `lib/validation/`: shared Zod schemas
- `supabase/`: schema, policies, and seed SQL

## Runtime Modes

### Demo mode

Demo mode is automatic when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing.

- Signup and login work locally in the browser
- New client accounts receive a starter organisation workspace
- New field-team accounts receive seeded applications and reviews
- Data persists in browser `localStorage`

### Live mode

When Supabase env vars are present, the app uses Supabase Auth and table CRUD through the live provider.

- Auth: email/password via Supabase
- Data: browser client against Supabase tables
- Security: intended to work with the RLS policies in `supabase/policies.sql`

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SITE_URL=https://www.athenapro.co.uk
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SMTP2GO_SMTP_HOST=mail.smtp2go.com
SMTP2GO_SMTP_PORT=587
SMTP2GO_SMTP_USER=your-smtp2go-user
SMTP2GO_SMTP_PASSWORD=your-smtp2go-password
SMTP2GO_FROM_EMAIL=ops@your-domain.com
SMTP2GO_FROM_NAME=Athena Pro
SMTP2GO_WEBHOOK_AUTH=Bearer your-smtp2go-webhook-secret
ATHENA_REGISTERED_OFFICE=Your registered office postal address
ATHENA_COMPANY_REGISTRATION=Your company registration number
ATHENA_ENQUIRIES_EMAIL=inbox-for-website-enquiries@your-domain.com
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/admin/google/oauth/callback
# Invoicing
ATHENA_BANK_ACCOUNT_NAME=Athena Pro Ltd
ATHENA_BANK_SORT_CODE=12-34-56
ATHENA_BANK_ACCOUNT_NUMBER=12345678
ATHENA_VAT_NUMBER=GB123456789   # leave unset if not VAT registered
ATHENA_VAT_RATE=20              # 0 or unset adds no VAT
ATHENA_INVOICE_TERMS_DAYS=14    # days to pay, from the send date
# Card payments on invoices (Stripe)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

`SUPABASE_SERVICE_ROLE_KEY` is only for server-side/public service usage and setup tasks. Do not expose it in client code.

Notes for a live deploy:

- `SUPABASE_SERVICE_ROLE_KEY` is required. The public home, jobs and field-team pages read through it, and they show empty lists (with an error in the logs) if it is missing.
- `SMTP2GO_WEBHOOK_AUTH` is required for the SMTP2GO webhook. Without it the webhook is refused in live mode.
- `ATHENA_ENQUIRIES_EMAIL` receives contact-form enquiries. It falls back to the public support address.
- `NEXT_PUBLIC_SITE_URL` is the public domain used for canonical links, the sitemap and share previews. It defaults to https://www.athenapro.co.uk.
- An invalid value in any one variable is ignored and logged, rather than switching the whole site to demo mode.
- Invoices show the `ATHENA_BANK_*` details for bank transfer. The admin portal won't send invoices until bank details or Stripe keys are set.
- Card payments need both Stripe keys. In the Stripe dashboard, add a webhook endpoint at `https://your-domain.com/api/stripe/webhook` for the events `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and copy its signing secret into `STRIPE_WEBHOOK_SECRET`. Paid invoices are then marked paid automatically.
- A production build without Supabase settings refuses the admin portal. Set `ATHENA_ALLOW_DEMO=true` only if you deliberately want a public demo.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality Commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Supabase Setup

Run the SQL in this order:

1. `supabase/schema.sql`
2. `supabase/policies.sql`
3. `supabase/athena-admin-schema.sql`
4. `supabase/seed.sql` (sample data, skip it on the production project)

All four files are safe to run again. On an existing project, re-run `policies.sql` and then `athena-admin-schema.sql` after pulling changes to them.

Row-level security helpers (`is_org_member`, `is_organiser`, `is_active_admin_user` and friends) live in a `private` schema. Supabase's API does not expose that schema, so they cannot be called as RPCs, but the `anon` and `authenticated` roles keep `EXECUTE` on them because Postgres evaluates policies as the querying role. Revoking that grant makes every policy that uses them fail with "permission denied for function".

## Production Notes

- The app keeps provider and service boundaries so the demo/runtime split remains intact.
- Persisted role enums remain `organiser` and `staff` internally for compatibility, while the UI is presented as client and field team.
- The contact form emails enquiries through SMTP2GO to `ATHENA_ENQUIRIES_EMAIL`.
- Finance in the admin portal: finished jobs with a client charge rate appear under "Ready to invoice". Admins draft an invoice, check it, and send it. The client gets an email with a link to view, print and pay (bank transfer, or card when Stripe is set up). Bank payments are recorded by an admin; card payments are recorded by the Stripe webhook. Operator pay owed is worked out from finished shifts, and payouts are recorded after paying from the bank.
