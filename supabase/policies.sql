alter table if exists public.organizations enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.marketing_preferences enable row level security;
alter table if exists public.operator_profiles enable row level security;
alter table if exists public.operator_availability_rules enable row level security;
alter table if exists public.operator_payment_profiles enable row level security;
alter table if exists public.organization_memberships enable row level security;
alter table if exists public.events enable row level security;
alter table if exists public.jobs enable row level security;
alter table if exists public.applications enable row level security;
alter table if exists public.application_status_history enable row level security;
alter table if exists public.job_view_events enable row level security;
alter table if exists public.saved_jobs enable row level security;
alter table if exists public.job_alerts enable row level security;
alter table if exists public.ratings enable row level security;
alter table if exists public.client_feedback enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.notification_email_jobs enable row level security;

-- RLS helper functions live in a "private" schema. Supabase's API (PostgREST) only
-- exposes "public", so these cannot be called as RPCs, but anon/authenticated still
-- need EXECUTE because Postgres runs policy expressions as the querying role.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = org_id
      and m.profile_id = auth.uid()
  );
$$;

revoke execute on function private.is_org_member(uuid) from public;
grant execute on function private.is_org_member(uuid) to anon, authenticated, service_role;

create or replace function private.is_organiser()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'organiser'
  );
$$;

revoke execute on function private.is_organiser() from public;
grant execute on function private.is_organiser() to anon, authenticated, service_role;

-- Field-team profiles hold email and phone numbers, so only the owner and signed-in
-- clients can read them. The public staff directory is served by the server, which
-- strips contact details before anything reaches the browser.
drop policy if exists "profiles_select_self_or_public_staff" on public.profiles;
drop policy if exists "profiles_select_self_or_organisers" on public.profiles;
create policy "profiles_select_self_or_organisers"
on public.profiles
for select
using (id = auth.uid() or (role = 'staff' and private.is_organiser()));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
with check (id = auth.uid());

do $$
begin
  if to_regclass('public.marketing_preferences') is not null then
    execute 'drop policy if exists "marketing_preferences_select_self" on public.marketing_preferences';
    execute 'create policy "marketing_preferences_select_self" on public.marketing_preferences for select using (profile_id = auth.uid())';
    execute 'drop policy if exists "marketing_preferences_insert_self" on public.marketing_preferences';
    execute 'create policy "marketing_preferences_insert_self" on public.marketing_preferences for insert with check (profile_id = auth.uid())';
    execute 'drop policy if exists "marketing_preferences_update_self" on public.marketing_preferences';
    execute 'create policy "marketing_preferences_update_self" on public.marketing_preferences for update using (profile_id = auth.uid()) with check (profile_id = auth.uid())';
  end if;
end $$;

do $$
begin
  if to_regclass('public.operator_profiles') is not null then
    execute 'drop policy if exists "operator_profiles_select_self_or_organiser" on public.operator_profiles';
    execute $policy$
      create policy "operator_profiles_select_self_or_organiser"
      on public.operator_profiles
      for select
      using (
        profile_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid() and p.role = 'organiser'
        )
      )
    $policy$;
    execute 'drop policy if exists "operator_profiles_upsert_self" on public.operator_profiles';
    execute 'create policy "operator_profiles_upsert_self" on public.operator_profiles for all using (profile_id = auth.uid()) with check (profile_id = auth.uid())';
  end if;
end $$;

do $$
begin
  if to_regclass('public.operator_availability_rules') is not null then
    execute 'drop policy if exists "operator_availability_select_self_or_organiser" on public.operator_availability_rules';
    execute $policy$
      create policy "operator_availability_select_self_or_organiser"
      on public.operator_availability_rules
      for select
      using (
        operator_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid() and p.role = 'organiser'
        )
      )
    $policy$;
    execute 'drop policy if exists "operator_availability_manage_self" on public.operator_availability_rules';
    execute 'create policy "operator_availability_manage_self" on public.operator_availability_rules for all using (operator_id = auth.uid()) with check (operator_id = auth.uid())';
  end if;
end $$;

do $$
begin
  if to_regclass('public.operator_payment_profiles') is not null then
    execute 'drop policy if exists "operator_payment_select_self" on public.operator_payment_profiles';
    execute $policy$
      create policy "operator_payment_select_self"
      on public.operator_payment_profiles
      for select
      using (
        operator_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid() and p.role = 'organiser'
        )
      )
    $policy$;
    execute 'drop policy if exists "operator_payment_manage_self" on public.operator_payment_profiles';
    execute 'create policy "operator_payment_manage_self" on public.operator_payment_profiles for all using (operator_id = auth.uid()) with check (operator_id = auth.uid())';
  end if;
end $$;

-- Organisation names appear on public job listings, so anyone can read them.
-- The table only holds id, name, slug and created_at.
drop policy if exists "organizations_select_members" on public.organizations;
drop policy if exists "organizations_select_public" on public.organizations;
create policy "organizations_select_public"
on public.organizations
for select
using (true);

drop policy if exists "organizations_insert_owner" on public.organizations;
create policy "organizations_insert_owner"
on public.organizations
for insert
with check (auth.uid() is not null);

drop policy if exists "memberships_select_self_or_org_members" on public.organization_memberships;
create policy "memberships_select_self_or_org_members"
on public.organization_memberships
for select
using (profile_id = auth.uid() or private.is_org_member(organization_id));

drop policy if exists "memberships_insert_self" on public.organization_memberships;
create policy "memberships_insert_self"
on public.organization_memberships
for insert
with check (profile_id = auth.uid());

drop policy if exists "events_public_read_published" on public.events;
create policy "events_public_read_published"
on public.events
for select
using (status in ('published', 'completed') or private.is_org_member(organization_id));

drop policy if exists "events_org_manage" on public.events;
create policy "events_org_manage"
on public.events
for all
using (private.is_org_member(organization_id))
with check (private.is_org_member(organization_id) and created_by = auth.uid());

drop policy if exists "jobs_public_read_open_closed" on public.jobs;
create policy "jobs_public_read_open_closed"
on public.jobs
for select
using (status in ('open', 'closed') or private.is_org_member(organization_id));

drop policy if exists "jobs_org_manage" on public.jobs;
create policy "jobs_org_manage"
on public.jobs
for all
using (private.is_org_member(organization_id))
with check (private.is_org_member(organization_id) and created_by = auth.uid());

drop policy if exists "applications_staff_read_own" on public.applications;
create policy "applications_staff_read_own"
on public.applications
for select
using (
  staff_id = auth.uid()
  or private.is_org_member((select organization_id from public.jobs where id = job_id))
);

drop policy if exists "applications_staff_insert_own" on public.applications;
create policy "applications_staff_insert_own"
on public.applications
for insert
with check (
  staff_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'staff'
  )
  and exists (
    select 1 from public.jobs j
    where j.id = job_id and j.status = 'open'
  )
);

drop policy if exists "applications_update_by_owner_or_staff_withdraw" on public.applications;
create policy "applications_update_by_owner_or_staff_withdraw"
on public.applications
for update
using (
  staff_id = auth.uid()
  or private.is_org_member((select organization_id from public.jobs where id = job_id))
)
with check (
  (
    staff_id = auth.uid()
    and status = 'withdrawn'
  )
  or private.is_org_member((select organization_id from public.jobs where id = job_id))
);

drop policy if exists "history_read_related_users" on public.application_status_history;
create policy "history_read_related_users"
on public.application_status_history
for select
using (
  exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = application_id
      and (a.staff_id = auth.uid() or private.is_org_member(j.organization_id))
  )
);

do $$
begin
  if to_regclass('public.job_view_events') is not null then
    execute 'drop policy if exists "job_view_events_read_self" on public.job_view_events';
    execute 'create policy "job_view_events_read_self" on public.job_view_events for select using (viewer_id = auth.uid())';
    execute 'drop policy if exists "job_view_events_insert_self" on public.job_view_events';
    execute $policy$
      create policy "job_view_events_insert_self"
      on public.job_view_events
      for insert
      with check (
        viewer_id = auth.uid()
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid() and p.role = 'staff'
        )
        and exists (
          select 1
          from public.jobs j
          where j.id = job_id and j.status = 'open'
        )
      )
    $policy$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.saved_jobs') is not null then
    execute 'drop policy if exists "saved_jobs_manage_self" on public.saved_jobs';
    execute $policy$
      create policy "saved_jobs_manage_self"
      on public.saved_jobs
      for all
      using (staff_id = auth.uid())
      with check (
        staff_id = auth.uid()
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid() and p.role = 'staff'
        )
      )
    $policy$;
  end if;

  if to_regclass('public.job_alerts') is not null then
    execute 'drop policy if exists "job_alerts_manage_self" on public.job_alerts';
    execute $policy$
      create policy "job_alerts_manage_self"
      on public.job_alerts
      for all
      using (staff_id = auth.uid())
      with check (
        staff_id = auth.uid()
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid() and p.role = 'staff'
        )
      )
    $policy$;
  end if;
end $$;

drop policy if exists "ratings_read_authenticated" on public.ratings;
create policy "ratings_read_authenticated"
on public.ratings
for select
using (auth.uid() is not null);

drop policy if exists "ratings_insert_authorised_organisers" on public.ratings;
create policy "ratings_insert_authorised_organisers"
on public.ratings
for insert
with check (
  organiser_id = auth.uid()
  and private.is_org_member(organization_id)
  and exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.events e on e.id = j.event_id
    where a.staff_id = ratings.staff_id
      and a.job_id = ratings.job_id
      and a.status = 'accepted'
      and e.id = ratings.event_id
      and e.status = 'completed'
      and j.organization_id = ratings.organization_id
  )
);

do $$
begin
  if to_regclass('public.client_feedback') is not null then
    execute 'drop policy if exists "client_feedback_read_self_or_org" on public.client_feedback';
    execute 'create policy "client_feedback_read_self_or_org" on public.client_feedback for select using (staff_id = auth.uid() or private.is_org_member(organization_id))';
    execute 'drop policy if exists "client_feedback_insert_self" on public.client_feedback';
    execute $policy$
      create policy "client_feedback_insert_self"
      on public.client_feedback
      for insert
      with check (
        staff_id = auth.uid()
        and exists (
          select 1
          from public.applications a
          join public.jobs j on j.id = a.job_id
          join public.events e on e.id = j.event_id
          where a.id = client_feedback.assignment_id
            and a.staff_id = auth.uid()
            and a.status = 'accepted'
            and e.status = 'completed'
            and j.organization_id = client_feedback.organization_id
        )
      )
    $policy$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.notifications') is not null then
    execute 'drop policy if exists "notifications_read_self" on public.notifications';
    execute 'create policy "notifications_read_self" on public.notifications for select using (user_id = auth.uid())';
    execute 'drop policy if exists "notifications_update_self" on public.notifications';
    execute 'create policy "notifications_update_self" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;
end $$;

do $$
begin
  if to_regclass('public.notification_email_jobs') is not null then
    execute 'drop policy if exists "notification_email_jobs_read_self" on public.notification_email_jobs';
    execute 'create policy "notification_email_jobs_read_self" on public.notification_email_jobs for select using (user_id = auth.uid())';
  end if;
end $$;

-- Remove the old public helper (earlier versions revoked EXECUTE from the API roles,
-- which made every policy that used it fail with "permission denied").
drop function if exists public.is_org_member(uuid);
