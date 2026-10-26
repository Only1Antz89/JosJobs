import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = path.resolve(__dirname, "..");
const schemaSql = readFileSync(path.join(workspaceRoot, "supabase/schema.sql"), "utf8");
const athenaAdminSql = readFileSync(path.join(workspaceRoot, "supabase/athena-admin-schema.sql"), "utf8");
const policiesSql = readFileSync(path.join(workspaceRoot, "supabase/policies.sql"), "utf8");

const publicViews = [
  "staff_rating_summary",
  "ranked_staff",
  "application_activity",
  "rating_queue"
];

const athenaViews = [
  "client_finance_summary",
  "operator_performance_summary",
  "client_usage_summary",
  "operator_rankings"
];

const athenaRlsTables = [
  "admin_users",
  "clients",
  "operators",
  "operator_documents",
  "assignments",
  "assignment_applications",
  "client_operator_preferences",
  "assignment_placements",
  "operator_reviews",
  "client_invoices",
  "invoice_assignment_links",
  "client_payments",
  "operator_payouts",
  "onboarding_checklists",
  "campaigns",
  "email_templates",
  "email_deliveries",
  "campaign_recipients",
  "email_webhook_events",
  "email_suppressions",
  "export_jobs",
  "audit_logs"
];

const triggerDefinerHelpers = [
  { sql: schemaSql, signature: "public.log_application_status_change()" }
];

// RLS helpers must stay executable by the API roles, because Postgres evaluates policy
// expressions as the querying role. They live in the unexposed "private" schema so
// they cannot be called as RPCs.
const rlsHelpers = [
  { sql: athenaAdminSql, signature: "private.is_active_admin_user()" },
  { sql: athenaAdminSql, signature: "private.is_client_owner(uuid)" },
  { sql: athenaAdminSql, signature: "private.is_operator_owner(uuid)" },
  { sql: athenaAdminSql, signature: "private.is_assignment_client_owner(uuid)" },
  { sql: athenaAdminSql, signature: "private.is_assignment_operator(uuid)" },
  { sql: policiesSql, signature: "private.is_org_member(uuid)" },
  { sql: policiesSql, signature: "private.is_organiser()" }
];

describe("supabase security hardening", () => {
  it("marks public marketplace views as security invoker", () => {
    for (const viewName of publicViews) {
      expect(schemaSql).toMatch(
        new RegExp(`create view public\\.${viewName}\\s+with \\(security_invoker = true\\) as`, "i")
      );
    }
  });

  it("marks athena admin views as security invoker", () => {
    for (const viewName of athenaViews) {
      expect(athenaAdminSql).toMatch(
        new RegExp(`create or replace view public\\.${viewName}\\s+with \\(security_invoker = true\\) as`, "i")
      );
    }
  });

  it("enables row level security on the exposed athena admin tables", () => {
    for (const tableName of athenaRlsTables) {
      expect(athenaAdminSql).toContain(`alter table if exists public.${tableName} enable row level security;`);
    }
  });

  it("keeps the authenticated admin bootstrap path available", () => {
    expect(athenaAdminSql).toContain("create or replace function private.is_active_admin_user()");
    expect(athenaAdminSql).toContain('create policy "admin_users_select_self"');
  });

  it("pins mutable function search_path for trigger helpers", () => {
    expect(schemaSql).toMatch(/create or replace function public\.set_updated_at\(\)\s+returns trigger\s+language plpgsql\s+set search_path = public/i);
    expect(schemaSql).toMatch(/create or replace function public\.set_operator_profile_age\(\)\s+returns trigger\s+language plpgsql\s+set search_path = public/i);
    expect(schemaSql).toMatch(/create or replace function public\.log_application_status_change\(\)\s+returns trigger\s+language plpgsql\s+security definer\s+set search_path = public/i);
  });

  it("does not leave trigger-only security definer helpers callable via exposed rpc roles", () => {
    for (const helper of triggerDefinerHelpers) {
      expect(helper.sql).toContain(`revoke execute on function ${helper.signature} from public;`);
      expect(helper.sql).toContain(`revoke execute on function ${helper.signature} from anon;`);
      expect(helper.sql).toContain(`revoke execute on function ${helper.signature} from authenticated;`);
    }
  });

  it("keeps RLS helpers in the private schema and executable by the roles that run policies", () => {
    for (const helper of rlsHelpers) {
      expect(helper.sql).toContain(`create or replace function ${helper.signature.replace(/\(uuid\)$/, "(")}`);
      expect(helper.sql).toContain(`revoke execute on function ${helper.signature} from public;`);
      expect(helper.sql).toContain(
        `grant execute on function ${helper.signature} to anon, authenticated, service_role;`
      );
    }

    expect(policiesSql).toContain("grant usage on schema private to anon, authenticated, service_role;");
    const policyLines = `${policiesSql}\n${athenaAdminSql}`
      .split("\n")
      .filter((line) => !line.startsWith("drop function if exists"));
    for (const line of policyLines) {
      expect(line).not.toMatch(
        /\bpublic\.is_(org_member|active_admin_user|client_owner|operator_owner|assignment_client_owner|assignment_operator)\(/
      );
    }
  });

  it("does not expose field-team contact details to anonymous visitors", () => {
    expect(policiesSql).not.toContain("using (id = auth.uid() or role = 'staff');");
    expect(policiesSql).toContain("using (id = auth.uid() or (role = 'staff' and private.is_organiser()));");
  });

  it("does not use an always-true organization insert policy", () => {
    expect(policiesSql).toContain('create policy "organizations_insert_owner"');
    expect(policiesSql).toContain("with check (auth.uid() is not null);");
    expect(policiesSql).not.toContain("with check (true);");
  });
});
