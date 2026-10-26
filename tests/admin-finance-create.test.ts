import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  inserted: [] as Array<{ table: string; row: unknown }>,
  deleted: [] as string[]
}));

function query(table: string) {
  let rows = state.tables[table] ?? [];
  const builder = {
    select: () => builder,
    in: (column: string, values: string[]) => {
      rows = rows.filter((row) => values.includes(String(row[column])));
      return builder;
    },
    then: (resolve: (value: { data: unknown; error: null }) => void) => resolve({ data: rows, error: null })
  };
  return builder;
}

function buildClient() {
  return {
    rpc: vi.fn(async () => ({ data: "ATH-1001", error: null })),
    from: (table: string) => ({
      ...query(table),
      insert: (row: unknown) => {
        state.inserted.push({ table, row });
        const result = { data: { id: "inv-1", invoice_number: "ATH-1001" }, error: null };
        return {
          select: () => ({ single: async () => result }),
          then: (resolve: (value: { error: null }) => void) => resolve({ error: null })
        };
      },
      delete: () => ({
        eq: async (_column: string, value: string) => {
          state.deleted.push(`${table}:${value}`);
          return { error: null };
        }
      })
    })
  };
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => buildClient() }));
vi.mock("@/lib/env", () => ({ env: { vatRate: 20, invoiceTermsDays: 14, hasBankDetails: true, hasStripe: false } }));
vi.mock("@/lib/services/admin-communications", () => ({ sendTransactionalTemplateEmail: vi.fn() }));
vi.mock("@/lib/services/admin-mutations", () => ({
  ensureClientRow: vi.fn(async () => ({ id: "client-row-1" })),
  ensureOperatorRow: vi.fn(),
  writeAuditLog: vi.fn(async () => undefined)
}));

const { createInvoice } = await import("@/lib/services/admin-finance");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
const JOB_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = Date.parse("2026-11-10T12:00:00Z");

describe("createInvoice", () => {
  beforeEach(() => {
    state.inserted = [];
    state.deleted = [];
    state.tables = {
      jobs: [
        { id: JOB_A, event_id: "e1", organization_id: ORG, title: "Steward", shift_start: "2026-11-01T10:00:00Z", shift_end: "2026-11-01T14:00:00Z", pay_rate: 12, charge_rate: 20, status: "closed" },
        { id: JOB_B, event_id: "e1", organization_id: ORG, title: "Scanner", shift_start: "2026-11-01T10:00:00Z", shift_end: "2026-11-01T14:00:00Z", pay_rate: 12, charge_rate: null, status: "closed" }
      ],
      events: [{ id: "e1", title: "Autumn Fair" }],
      applications: [
        { job_id: JOB_A, status: "accepted" },
        { job_id: JOB_A, status: "accepted" },
        { job_id: JOB_B, status: "accepted" }
      ],
      invoice_lines: []
    };
  });

  it("prices job lines on the server and adds VAT", async () => {
    const result = await createInvoice("admin-1", { organizationId: ORG, jobIds: [JOB_A], extraLines: [] }, NOW);

    expect(result).toEqual({ id: "inv-1", invoiceNumber: "ATH-1001" });
    const invoice = state.inserted.find((entry) => entry.table === "client_invoices")?.row;
    expect(invoice).toMatchObject({
      client_id: "client-row-1",
      status: "draft",
      subtotal: 160,
      tax_amount: 32,
      total_amount: 192,
      issue_date: "2026-11-10",
      due_date: "2026-11-24"
    });
    const lines = state.inserted.find((entry) => entry.table === "invoice_lines")?.row as Array<Record<string, unknown>>;
    expect(lines).toEqual([expect.objectContaining({ job_id: JOB_A, quantity: 8, unit_amount: 20, amount: 160 })]);
  });

  it("refuses jobs without a charge rate", async () => {
    await expect(
      createInvoice("admin-1", { organizationId: ORG, jobIds: [JOB_B], extraLines: [] }, NOW)
    ).rejects.toThrow(/charge rate/);
    expect(state.inserted).toHaveLength(0);
  });

  it("refuses jobs already on a live invoice or owned by another client", async () => {
    state.tables.invoice_lines = [{ job_id: JOB_A, client_invoices: { status: "sent" } }];
    await expect(
      createInvoice("admin-1", { organizationId: ORG, jobIds: [JOB_A], extraLines: [] }, NOW)
    ).rejects.toMatchObject({ status: 409 });

    state.tables.invoice_lines = [];
    await expect(
      createInvoice("admin-1", { organizationId: OTHER_ORG, jobIds: [JOB_A], extraLines: [] }, NOW)
    ).rejects.toMatchObject({ status: 409 });
  });

  it("lets a job be billed again once its invoice is void", async () => {
    state.tables.invoice_lines = [{ job_id: JOB_A, client_invoices: { status: "void" } }];
    await expect(
      createInvoice("admin-1", { organizationId: ORG, jobIds: [JOB_A], extraLines: [] }, NOW)
    ).resolves.toMatchObject({ invoiceNumber: "ATH-1001" });
  });
});
