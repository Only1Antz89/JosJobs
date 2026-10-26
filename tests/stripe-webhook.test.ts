import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const state = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
  error: null as unknown
}));

vi.mock("@/lib/env", () => ({ env: { stripeWebhookSecret: "whsec_test", stripeSecretKey: "sk_test", hasStripe: true } }));
vi.mock("@/lib/services/admin-finance", () => ({
  recordInvoicePayment: vi.fn(async (input: Record<string, unknown>) => {
    if (state.error) throw state.error;
    state.calls.push(input);
    return { recorded: true };
  })
}));

const { POST } = await import("@/app/api/stripe/webhook/route");

function signedRequest(event: unknown) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", "whsec_test").update(`${timestamp}.${body}`).digest("hex");
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
    body
  });
}

const paidSession = {
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_1",
      payment_status: "paid",
      amount_total: 32450,
      currency: "gbp",
      payment_intent: "pi_1",
      metadata: { invoice_id: "inv-1" },
      created: 1_793_000_000
    }
  }
};

describe("Stripe webhook", () => {
  beforeEach(() => {
    state.calls = [];
    state.error = null;
  });

  it("records a paid checkout as a card payment in pounds", async () => {
    const response = await POST(signedRequest(paidSession));
    expect(response.status).toBe(200);
    expect(state.calls).toEqual([
      expect.objectContaining({ invoiceId: "inv-1", amount: 324.5, method: "card", reference: "pi_1", actorId: null })
    ]);
  });

  it("rejects unsigned requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", { method: "POST", body: JSON.stringify(paidSession) })
    );
    expect(response.status).toBe(400);
    expect(state.calls).toHaveLength(0);
  });

  it("ignores unpaid sessions and other events", async () => {
    await POST(signedRequest({ ...paidSession, data: { object: { ...paidSession.data.object, payment_status: "unpaid" } } }));
    await POST(signedRequest({ type: "payment_intent.created", data: { object: {} } }));
    expect(state.calls).toHaveLength(0);
  });

  it("asks Stripe to retry on temporary failures but not on permanent ones", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.error = new Error("database down");
    expect((await POST(signedRequest(paidSession))).status).toBe(500);

    state.error = new AppError("Invoice ATH-1 is void", "FINANCE_FAILED", 409);
    expect((await POST(signedRequest(paidSession))).status).toBe(200);
    consoleError.mockRestore();
  });
});
