import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; row: unknown }>,
  deletes: [] as string[],
  deletedUsers: [] as string[],
  failTable: null as string | null,
  createUserError: null as null | { message: string },
  emailFails: false,
  emails: [] as Array<Record<string, unknown>>
}));

function buildClient() {
  return {
    auth: {
      admin: {
        createUser: vi.fn(async () =>
          state.createUserError
            ? { data: { user: null }, error: state.createUserError }
            : { data: { user: { id: "11111111-1111-4111-8111-111111111111" } }, error: null }
        ),
        deleteUser: vi.fn(async (id: string) => {
          state.deletedUsers.push(id);
          return { error: null };
        }),
        generateLink: vi.fn(async () => ({
          data: { properties: { action_link: "https://auth.example/link" } },
          error: null
        }))
      }
    },
    from: vi.fn((table: string) => ({
      insert: (row: unknown) => {
        state.inserts.push({ table, row });
        return Promise.resolve({ error: state.failTable === table ? { message: "boom" } : null });
      },
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) })
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({
        eq: (_column: string, value: string) => {
          state.deletes.push(`${table}:${value}`);
          return Promise.resolve({ error: null });
        }
      })
    }))
  };
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => buildClient() }));

vi.mock("@/lib/services/admin-communications", () => ({
  sendTransactionalTemplateEmail: vi.fn(async (input: Record<string, unknown>) => {
    if (state.emailFails) throw new Error("SMTP down");
    state.emails.push(input);
    return { status: "sent" };
  })
}));

vi.mock("@/lib/services/admin-mutations", () => ({
  ensureClientRow: vi.fn(async () => ({ id: "client-row" })),
  ensureOperatorRow: vi.fn(async () => ({ id: "operator-row" })),
  writeAuditLog: vi.fn(async () => undefined)
}));

const { inviteClient, inviteClientSchema, inviteOperator, inviteOperatorSchema } = await import(
  "@/lib/services/admin-invites"
);

const operatorInput = inviteOperatorSchema.parse({
  fullName: "Ava Morgan",
  email: "Ava@Example.com",
  location: "London",
  skillTags: ["Ticket Scanning"]
});

describe("admin invites", () => {
  beforeEach(() => {
    state.inserts = [];
    state.deletes = [];
    state.deletedUsers = [];
    state.failTable = null;
    state.createUserError = null;
    state.emailFails = false;
    state.emails = [];
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("creates every operator row the public sign-up creates and emails a set-password link", async () => {
    const result = await inviteOperator("admin-1", operatorInput, "https://app.example");

    expect(result).toEqual({ id: "11111111-1111-4111-8111-111111111111", warning: undefined });
    expect(state.inserts.map((entry) => entry.table).sort()).toEqual(
      ["marketing_preferences", "operator_availability_rules", "operator_payment_profiles", "operator_profiles", "profiles"].sort()
    );
    expect(state.inserts.find((entry) => entry.table === "profiles")?.row).toMatchObject({
      role: "staff",
      email: "ava@example.com"
    });
    expect(state.emails[0]).toMatchObject({
      to: "ava@example.com",
      templateType: "operator_onboarding",
      ctaUrl: "https://auth.example/link"
    });
  });

  it("does not opt invited people into marketing", async () => {
    await inviteOperator("admin-1", operatorInput, "https://app.example");
    expect(state.inserts.find((entry) => entry.table === "marketing_preferences")?.row).toMatchObject({
      newsletter_opt_in: false,
      offers_opt_in: false,
      product_updates_opt_in: false
    });
  });

  it("removes the half-made account when a step fails", async () => {
    state.failTable = "operator_profiles";
    await expect(inviteOperator("admin-1", operatorInput, "https://app.example")).rejects.toThrow(
      /operator profile/
    );
    expect(state.deletedUsers).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(state.emails).toHaveLength(0);
  });

  it("removes the company too when a client invite fails", async () => {
    state.failTable = "organization_memberships";
    const input = inviteClientSchema.parse({ companyName: "Acme Events", contactName: "Sam Lee", email: "sam@acme.test" });
    await expect(inviteClient("admin-1", input, "https://app.example")).rejects.toThrow();
    expect(state.deletes.some((entry) => entry.startsWith("organizations:"))).toBe(true);
    expect(state.deletedUsers).toHaveLength(1);
  });

  it("explains a duplicate email clearly", async () => {
    state.createUserError = { message: "A user with this email address has already been registered" };
    await expect(inviteOperator("admin-1", operatorInput, "https://app.example")).rejects.toMatchObject({
      status: 409
    });
  });

  it("keeps the account but warns the admin when the email can't be sent", async () => {
    state.emailFails = true;
    const result = await inviteOperator("admin-1", operatorInput, "https://app.example");
    expect(result.warning).toMatch(/Forgot password/);
    expect(state.deletedUsers).toHaveLength(0);
  });
});
