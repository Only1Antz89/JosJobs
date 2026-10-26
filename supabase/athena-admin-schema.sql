create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'admin_role' and n.nspname = 'public'
  ) then
    create type public.admin_role as enum (
      'super_admin',
      'operations_admin',
      'finance_admin',
      'marketing_admin'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'onboarding_status' and n.nspname = 'public'
  ) then
    create type public.onboarding_status as enum (
      'pending',
      'in_review',
      'approved',
      'rejected'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'assignment_status' and n.nspname = 'public'
  ) then
    create type public.assignment_status as enum (
      'draft',
      'open',
      'partially_filled',
      'filled',
      'in_progress',
      'completed',
      'cancelled'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'preference_type' and n.nspname = 'public'
  ) then
    create type public.preference_type as enum (
      'favourite',
      'blocked'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'campaign_status' and n.nspname = 'public'
  ) then
    create type public.campaign_status as enum (
      'draft',
      'scheduled',
      'sending',
      'sent',
      'failed'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'campaign_audience' and n.nspname = 'public'
  ) then
    create type public.campaign_audience as enum (
      'clients',
      'operators',
      'both'
    );
  end if;
end $$;

create table if not exists public.admin_users (
  id uuid primary key references public.profiles(id) on delete cascade,
  admin_role public.admin_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id),
  organization_id uuid references public.organizations(id) on delete set null,
  company_name text not null,
  trading_name text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  billing_contact_name text,
  billing_contact_email text,
  billing_contact_phone text,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postcode text,
  country text,
  vat_number text,
  status text not null default 'active',
  onboarding_status public.onboarding_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete cascade,
  display_name text,
  onboarding_status public.onboarding_status not null default 'pending',
  verification_status text not null default 'pending',
  regions text[] not null default '{}',
  skill_tags text[] not null default '{}',
  average_rating numeric(3,2) not null default 0,
  total_completed integer not null default 0,
  total_cancellations integer not null default 0,
  total_no_shows integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operator_documents (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  verification_status text not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  title text not null,
  description text,
  location_name text,
  address_line_1 text,
  city text,
  region text,
  postcode text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  required_headcount integer not null default 1,
  assignment_status public.assignment_status not null default 'draft',
  charge_rate numeric(10,2),
  pay_rate numeric(10,2),
  total_charge_amount numeric(12,2),
  total_pay_amount numeric(12,2),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignment_applications (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  operator_id uuid not null references public.operators(id) on delete cascade,
  application_status text not null default 'applied',
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  unique (assignment_id, operator_id)
);

create table if not exists public.assignment_placements (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  operator_id uuid not null references public.operators(id) on delete cascade,
  placement_status text not null default 'assigned',
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id),
  check_in_at timestamptz,
  check_out_at timestamptz,
  completed_at timestamptz,
  unique (assignment_id, operator_id)
);

create table if not exists public.client_operator_preferences (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  operator_id uuid not null references public.operators(id) on delete cascade,
  preference public.preference_type not null,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (client_id, operator_id, preference)
);

create table if not exists public.operator_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  operator_id uuid not null references public.operators(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text,
  punctuality_score integer check (punctuality_score between 1 and 5),
  reliability_score integer check (reliability_score between 1 and 5),
  created_at timestamptz not null default now(),
  unique (assignment_id, operator_id)
);

create table if not exists public.client_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_number text unique not null,
  issue_date date not null,
  due_date date not null,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_assignment_links (
  invoice_id uuid not null references public.client_invoices(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  primary key (invoice_id, assignment_id)
);

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_id uuid references public.client_invoices(id) on delete set null,
  amount numeric(12,2) not null,
  payment_date date not null,
  payment_method text,
  external_reference text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.operator_payouts (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_amount numeric(12,2) not null,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('client', 'operator')),
  entity_id uuid not null,
  checklist_key text not null,
  label text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  notes text
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  preview_text text not null default '',
  audience public.campaign_audience not null,
  template_type text not null default 'newsletter',
  marketing_category text not null default 'news',
  segment_key text,
  content_mode text not null default 'rich',
  content_json jsonb not null default '[]'::jsonb,
  markdown_content text,
  html_content text not null,
  google_doc_id text,
  google_doc_url text,
  status public.campaign_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.campaigns add column if not exists preview_text text not null default '';
alter table public.campaigns add column if not exists template_type text not null default 'newsletter';
alter table public.campaigns add column if not exists marketing_category text not null default 'news';
alter table public.campaigns add column if not exists content_mode text not null default 'rich';
alter table public.campaigns add column if not exists content_json jsonb not null default '[]'::jsonb;
alter table public.campaigns add column if not exists markdown_content text;
alter table public.campaigns add column if not exists google_doc_id text;
alter table public.campaigns add column if not exists google_doc_url text;
alter table public.campaigns add column if not exists updated_at timestamptz not null default now();

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_type text not null,
  subject_template text not null,
  preview_text text not null default '',
  body_html text not null,
  body_markdown text,
  is_system boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  template_type text not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  event_key text,
  category text not null default 'transactional',
  recipient_email text not null,
  recipient_name text,
  subject text not null,
  provider text not null default 'smtp2go',
  status text not null default 'queued',
  provider_message_id text,
  provider_email_id text,
  error_message text,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  unsubscribed_at timestamptz,
  rejected_at timestamptz,
  last_event text,
  last_event_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.email_deliveries add column if not exists event_key text;
alter table public.email_deliveries add column if not exists category text not null default 'transactional';
alter table public.email_deliveries add column if not exists provider_email_id text;
alter table public.email_deliveries add column if not exists delivered_at timestamptz;
alter table public.email_deliveries add column if not exists opened_at timestamptz;
alter table public.email_deliveries add column if not exists clicked_at timestamptz;
alter table public.email_deliveries add column if not exists bounced_at timestamptz;
alter table public.email_deliveries add column if not exists complained_at timestamptz;
alter table public.email_deliveries add column if not exists unsubscribed_at timestamptz;
alter table public.email_deliveries add column if not exists rejected_at timestamptz;
alter table public.email_deliveries add column if not exists last_event text;
alter table public.email_deliveries add column if not exists last_event_at timestamptz;
alter table public.email_deliveries add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  email text not null,
  recipient_type text not null,
  delivery_status text not null default 'pending',
  provider_message_id text,
  provider_email_id text,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  unsubscribed_at timestamptz,
  rejected_at timestamptz,
  last_event text,
  last_event_at timestamptz,
  failed_reason text
);

alter table public.campaign_recipients add column if not exists provider_message_id text;
alter table public.campaign_recipients add column if not exists provider_email_id text;
alter table public.campaign_recipients add column if not exists bounced_at timestamptz;
alter table public.campaign_recipients add column if not exists complained_at timestamptz;
alter table public.campaign_recipients add column if not exists unsubscribed_at timestamptz;
alter table public.campaign_recipients add column if not exists rejected_at timestamptz;
alter table public.campaign_recipients add column if not exists last_event text;
alter table public.campaign_recipients add column if not exists last_event_at timestamptz;

create table if not exists public.email_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'smtp2go',
  provider_event_id text,
  provider_email_id text,
  provider_message_id text,
  recipient_email text not null,
  event_type text not null,
  event_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.email_suppressions (
  email_normalized text primary key,
  reason text not null,
  source text not null default 'system',
  provider text not null default 'smtp2go',
  active boolean not null default true,
  details jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  export_type text not null,
  format text not null,
  filters jsonb not null default '{}'::jsonb,
  file_path text,
  requested_by uuid references public.profiles(id),
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.is_active_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where id = auth.uid()
      and is_active
  );
$$;

revoke execute on function private.is_active_admin_user() from public;
grant execute on function private.is_active_admin_user() to anon, authenticated, service_role;

create or replace function private.is_client_owner(client_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clients
    where id = client_uuid
      and owner_user_id = auth.uid()
  );
$$;

revoke execute on function private.is_client_owner(uuid) from public;
grant execute on function private.is_client_owner(uuid) to anon, authenticated, service_role;

create or replace function private.is_operator_owner(operator_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.operators
    where id = operator_uuid
      and user_id = auth.uid()
  );
$$;

revoke execute on function private.is_operator_owner(uuid) from public;
grant execute on function private.is_operator_owner(uuid) to anon, authenticated, service_role;

create or replace function private.is_assignment_client_owner(assignment_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    join public.clients c on c.id = a.client_id
    where a.id = assignment_uuid
      and c.owner_user_id = auth.uid()
  );
$$;

revoke execute on function private.is_assignment_client_owner(uuid) from public;
grant execute on function private.is_assignment_client_owner(uuid) to anon, authenticated, service_role;

create or replace function private.is_assignment_operator(assignment_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignment_applications aa
    join public.operators o on o.id = aa.operator_id
    where aa.assignment_id = assignment_uuid
      and o.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.assignment_placements ap
    join public.operators o on o.id = ap.operator_id
    where ap.assignment_id = assignment_uuid
      and o.user_id = auth.uid()
  );
$$;

revoke execute on function private.is_assignment_operator(uuid) from public;
grant execute on function private.is_assignment_operator(uuid) to anon, authenticated, service_role;

alter table if exists public.admin_users enable row level security;
alter table if exists public.clients enable row level security;
alter table if exists public.operators enable row level security;
alter table if exists public.operator_documents enable row level security;
alter table if exists public.assignments enable row level security;
alter table if exists public.assignment_applications enable row level security;
alter table if exists public.client_operator_preferences enable row level security;
alter table if exists public.assignment_placements enable row level security;
alter table if exists public.operator_reviews enable row level security;
alter table if exists public.client_invoices enable row level security;
alter table if exists public.invoice_assignment_links enable row level security;
alter table if exists public.client_payments enable row level security;
alter table if exists public.operator_payouts enable row level security;
alter table if exists public.onboarding_checklists enable row level security;
alter table if exists public.campaigns enable row level security;
alter table if exists public.email_templates enable row level security;
alter table if exists public.email_deliveries enable row level security;
alter table if exists public.campaign_recipients enable row level security;
alter table if exists public.email_webhook_events enable row level security;
alter table if exists public.email_suppressions enable row level security;
alter table if exists public.export_jobs enable row level security;
alter table if exists public.audit_logs enable row level security;

drop policy if exists "admin_users_select_self" on public.admin_users;
create policy "admin_users_select_self"
on public.admin_users
for select
using (id = auth.uid());

drop policy if exists "clients_select_owner_or_admin" on public.clients;
create policy "clients_select_owner_or_admin"
on public.clients
for select
using (owner_user_id = auth.uid() or private.is_active_admin_user());

drop policy if exists "clients_manage_admin_only" on public.clients;
create policy "clients_manage_admin_only"
on public.clients
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "operators_select_owner_or_admin" on public.operators;
create policy "operators_select_owner_or_admin"
on public.operators
for select
using (user_id = auth.uid() or private.is_active_admin_user());

drop policy if exists "operators_manage_owner_or_admin" on public.operators;
create policy "operators_manage_owner_or_admin"
on public.operators
for all
using (user_id = auth.uid() or private.is_active_admin_user())
with check (user_id = auth.uid() or private.is_active_admin_user());

drop policy if exists "operator_documents_select_related_or_admin" on public.operator_documents;
create policy "operator_documents_select_related_or_admin"
on public.operator_documents
for select
using (private.is_operator_owner(operator_id) or private.is_active_admin_user());

drop policy if exists "operator_documents_manage_related_or_admin" on public.operator_documents;
create policy "operator_documents_manage_related_or_admin"
on public.operator_documents
for all
using (private.is_operator_owner(operator_id) or private.is_active_admin_user())
with check (private.is_operator_owner(operator_id) or private.is_active_admin_user());

drop policy if exists "assignments_select_related_or_admin" on public.assignments;
create policy "assignments_select_related_or_admin"
on public.assignments
for select
using (
  private.is_assignment_client_owner(id)
  or private.is_active_admin_user()
  or private.is_assignment_operator(id)
);

drop policy if exists "assignments_manage_admin_only" on public.assignments;
create policy "assignments_manage_admin_only"
on public.assignments
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "assignment_applications_select_related_or_admin" on public.assignment_applications;
create policy "assignment_applications_select_related_or_admin"
on public.assignment_applications
for select
using (
  private.is_operator_owner(operator_id)
  or private.is_active_admin_user()
  or private.is_assignment_client_owner(assignment_id)
);

drop policy if exists "assignment_applications_manage_owner_or_admin" on public.assignment_applications;
create policy "assignment_applications_manage_owner_or_admin"
on public.assignment_applications
for all
using (private.is_operator_owner(operator_id) or private.is_active_admin_user())
with check (private.is_operator_owner(operator_id) or private.is_active_admin_user());

drop policy if exists "client_operator_preferences_select_related_or_admin" on public.client_operator_preferences;
create policy "client_operator_preferences_select_related_or_admin"
on public.client_operator_preferences
for select
using (
  private.is_client_owner(client_id)
  or private.is_operator_owner(operator_id)
  or private.is_active_admin_user()
);

drop policy if exists "client_operator_preferences_manage_client_or_admin" on public.client_operator_preferences;
create policy "client_operator_preferences_manage_client_or_admin"
on public.client_operator_preferences
for all
using (private.is_client_owner(client_id) or private.is_active_admin_user())
with check (private.is_client_owner(client_id) or private.is_active_admin_user());

drop policy if exists "assignment_placements_select_related_or_admin" on public.assignment_placements;
create policy "assignment_placements_select_related_or_admin"
on public.assignment_placements
for select
using (
  private.is_operator_owner(operator_id)
  or private.is_active_admin_user()
  or private.is_assignment_client_owner(assignment_id)
);

drop policy if exists "assignment_placements_manage_admin_only" on public.assignment_placements;
create policy "assignment_placements_manage_admin_only"
on public.assignment_placements
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "operator_reviews_select_related_or_admin" on public.operator_reviews;
create policy "operator_reviews_select_related_or_admin"
on public.operator_reviews
for select
using (
  private.is_operator_owner(operator_id)
  or private.is_client_owner(client_id)
  or private.is_active_admin_user()
);

drop policy if exists "operator_reviews_manage_client_or_admin" on public.operator_reviews;
create policy "operator_reviews_manage_client_or_admin"
on public.operator_reviews
for all
using (private.is_client_owner(client_id) or private.is_active_admin_user())
with check (private.is_client_owner(client_id) or private.is_active_admin_user());

drop policy if exists "client_invoices_select_related_or_admin" on public.client_invoices;
create policy "client_invoices_select_related_or_admin"
on public.client_invoices
for select
using (private.is_client_owner(client_id) or private.is_active_admin_user());

drop policy if exists "client_invoices_manage_admin_only" on public.client_invoices;
create policy "client_invoices_manage_admin_only"
on public.client_invoices
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "invoice_assignment_links_select_related_or_admin" on public.invoice_assignment_links;
create policy "invoice_assignment_links_select_related_or_admin"
on public.invoice_assignment_links
for select
using (
  private.is_active_admin_user()
  or exists (
    select 1
    from public.client_invoices i
    where i.id = invoice_assignment_links.invoice_id
      and private.is_client_owner(i.client_id)
  )
);

drop policy if exists "invoice_assignment_links_manage_admin_only" on public.invoice_assignment_links;
create policy "invoice_assignment_links_manage_admin_only"
on public.invoice_assignment_links
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "client_payments_select_related_or_admin" on public.client_payments;
create policy "client_payments_select_related_or_admin"
on public.client_payments
for select
using (private.is_client_owner(client_id) or private.is_active_admin_user());

drop policy if exists "client_payments_manage_admin_only" on public.client_payments;
create policy "client_payments_manage_admin_only"
on public.client_payments
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "operator_payouts_select_related_or_admin" on public.operator_payouts;
create policy "operator_payouts_select_related_or_admin"
on public.operator_payouts
for select
using (private.is_operator_owner(operator_id) or private.is_active_admin_user());

drop policy if exists "operator_payouts_manage_admin_only" on public.operator_payouts;
create policy "operator_payouts_manage_admin_only"
on public.operator_payouts
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "onboarding_checklists_select_related_or_admin" on public.onboarding_checklists;
create policy "onboarding_checklists_select_related_or_admin"
on public.onboarding_checklists
for select
using (
  private.is_active_admin_user()
  or (entity_type = 'client' and private.is_client_owner(entity_id))
  or (entity_type = 'operator' and private.is_operator_owner(entity_id))
);

drop policy if exists "onboarding_checklists_manage_admin_only" on public.onboarding_checklists;
create policy "onboarding_checklists_manage_admin_only"
on public.onboarding_checklists
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "campaigns_admin_only" on public.campaigns;
create policy "campaigns_admin_only"
on public.campaigns
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "email_templates_admin_only" on public.email_templates;
create policy "email_templates_admin_only"
on public.email_templates
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "email_deliveries_select_related_or_admin" on public.email_deliveries;
create policy "email_deliveries_select_related_or_admin"
on public.email_deliveries
for select
using (profile_id = auth.uid() or private.is_active_admin_user());

drop policy if exists "email_deliveries_manage_admin_only" on public.email_deliveries;
create policy "email_deliveries_manage_admin_only"
on public.email_deliveries
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "campaign_recipients_select_related_or_admin" on public.campaign_recipients;
create policy "campaign_recipients_select_related_or_admin"
on public.campaign_recipients
for select
using (profile_id = auth.uid() or private.is_active_admin_user());

drop policy if exists "campaign_recipients_manage_admin_only" on public.campaign_recipients;
create policy "campaign_recipients_manage_admin_only"
on public.campaign_recipients
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "email_webhook_events_admin_only" on public.email_webhook_events;
create policy "email_webhook_events_admin_only"
on public.email_webhook_events
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "email_suppressions_admin_only" on public.email_suppressions;
create policy "email_suppressions_admin_only"
on public.email_suppressions
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "export_jobs_select_requester_or_admin" on public.export_jobs;
create policy "export_jobs_select_requester_or_admin"
on public.export_jobs
for select
using (requested_by = auth.uid() or private.is_active_admin_user());

drop policy if exists "export_jobs_manage_admin_only" on public.export_jobs;
create policy "export_jobs_manage_admin_only"
on public.export_jobs
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

drop policy if exists "audit_logs_admin_only" on public.audit_logs;
create policy "audit_logs_admin_only"
on public.audit_logs
for all
using (private.is_active_admin_user())
with check (private.is_active_admin_user());

create or replace view public.client_finance_summary
with (security_invoker = true) as
select
  c.id as client_id,
  c.company_name,
  coalesce(sum(i.total_amount), 0) as total_invoiced,
  coalesce(sum(i.amount_paid), 0) as total_paid,
  coalesce(sum(i.total_amount - i.amount_paid), 0) as outstanding_balance
from public.clients c
left join public.client_invoices i on i.client_id = c.id
group by c.id, c.company_name;

create or replace view public.operator_performance_summary
with (security_invoker = true) as
select
  o.id as operator_id,
  o.display_name,
  o.total_completed,
  o.total_cancellations,
  o.total_no_shows,
  coalesce(avg(r.rating), 0)::numeric(3,2) as average_rating,
  count(distinct ap.assignment_id) as assignments_worked,
  count(distinct case when cop.preference = 'favourite' then cop.client_id end) as favourite_count,
  count(distinct case when cop.preference = 'blocked' then cop.client_id end) as blocked_count
from public.operators o
left join public.operator_reviews r on r.operator_id = o.id
left join public.assignment_placements ap on ap.operator_id = o.id
left join public.client_operator_preferences cop on cop.operator_id = o.id
group by o.id, o.display_name, o.total_completed, o.total_cancellations, o.total_no_shows;

create or replace view public.client_usage_summary
with (security_invoker = true) as
select
  c.id as client_id,
  c.company_name,
  count(distinct a.id) as total_assignments,
  count(distinct case when a.starts_at >= now() then a.id end) as future_assignments,
  count(distinct case when a.starts_at < now() then a.id end) as past_assignments,
  coalesce(sum(a.total_charge_amount), 0) as total_spend
from public.clients c
left join public.assignments a on a.client_id = c.id
group by c.id, c.company_name;

create or replace view public.operator_rankings
with (security_invoker = true) as
select
  ops.operator_id,
  ops.display_name,
  (
    (ops.average_rating * 0.30) +
    (least(ops.total_completed, 100) / 100.0 * 0.20) +
    ((1 - least(ops.total_cancellations, 20) / 20.0) * 0.15) +
    ((1 - least(ops.total_no_shows, 10) / 10.0) * 0.15) +
    (least(ops.favourite_count, 20) / 20.0 * 0.20)
  )::numeric(5,4) as ranking_score
from public.operator_performance_summary ops;

create index if not exists idx_admin_users_role on public.admin_users(admin_role);
create index if not exists idx_clients_status on public.clients(status, onboarding_status);
create index if not exists idx_operators_status on public.operators(verification_status, onboarding_status);
create index if not exists idx_assignments_status on public.assignments(assignment_status, starts_at);
create index if not exists idx_client_invoices_client on public.client_invoices(client_id, due_date desc);
create index if not exists idx_campaigns_status on public.campaigns(status, scheduled_at desc);
create index if not exists idx_campaigns_marketing_category on public.campaigns(marketing_category, status, scheduled_at desc);
create index if not exists idx_email_templates_type on public.email_templates(template_type);
create index if not exists idx_email_deliveries_campaign on public.email_deliveries(campaign_id, created_at desc);
create index if not exists idx_email_deliveries_recipient on public.email_deliveries(recipient_email, created_at desc);
create unique index if not exists idx_email_deliveries_event_key on public.email_deliveries(event_key) where event_key is not null;
create index if not exists idx_email_deliveries_provider_message on public.email_deliveries(provider_message_id);
create index if not exists idx_campaign_recipients_provider_message on public.campaign_recipients(provider_message_id);
create index if not exists idx_email_webhook_events_message on public.email_webhook_events(provider_message_id, created_at desc);
create index if not exists idx_email_suppressions_active on public.email_suppressions(active, email_normalized);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, created_at desc);

-- Remove the old public helpers now that every policy points at private.*.
drop function if exists public.is_active_admin_user();
drop function if exists public.is_client_owner(uuid);
drop function if exists public.is_operator_owner(uuid);
drop function if exists public.is_assignment_client_owner(uuid);
drop function if exists public.is_assignment_operator(uuid);

-- Recommended RLS direction:
-- 1. Keep public users restricted to their own client/operator records.
-- 2. Use server-side service-role access only for admin reads and privileged mutations.
-- 3. Gate admin UI access through admin_users plus explicit server-side checks.
