import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

// Minimal Stripe client for card payments on invoices. We only need two things:
// create a hosted Checkout page for an invoice balance, and verify webhooks.
// Using the REST API directly keeps the dependency list short.

const STRIPE_API = "https://api.stripe.com/v1";

export function isStripeEnabled() {
  return env.hasStripe;
}

function toFormBody(params: Record<string, string | number | undefined>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) body.append(key, String(value));
  }
  return body;
}

export async function createInvoiceCheckoutSession(input: {
  invoiceId: string;
  invoiceNumber: string;
  amountPence: number;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  if (!env.stripeSecretKey) {
    throw new AppError("Card payments are not set up yet.", "STRIPE_NOT_CONFIGURED", 503);
  }

  if (!Number.isInteger(input.amountPence) || input.amountPence < 30) {
    throw new AppError("This invoice has nothing left to pay by card.", "NOTHING_TO_PAY", 400);
  }

  const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Same invoice and amount within Stripe's idempotency window reuses the session.
      "Idempotency-Key": `invoice-${input.invoiceId}-${input.amountPence}-${new Date().toISOString().slice(0, 13)}`
    },
    body: toFormBody({
      mode: "payment",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail || undefined,
      client_reference_id: input.invoiceId,
      "metadata[invoice_id]": input.invoiceId,
      "payment_intent_data[metadata][invoice_id]": input.invoiceId,
      "payment_intent_data[description]": `Athena Pro invoice ${input.invoiceNumber}`,
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "gbp",
      "line_items[0][price_data][unit_amount]": input.amountPence,
      "line_items[0][price_data][product_data][name]": `Invoice ${input.invoiceNumber}`
    })
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; url?: string; error?: { message?: string } };

  if (!response.ok || !payload.url || !payload.id) {
    console.error("[athena] Stripe checkout failed", response.status, payload.error?.message);
    throw new AppError("Card payment could not be started. Please try again or pay by bank transfer.", "STRIPE_CHECKOUT_FAILED", 502);
  }

  return { id: payload.id, url: payload.url };
}

// Checks the Stripe-Signature header (t=timestamp,v1=signature) against the raw body.
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  now = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300
) {
  if (!header || !secret) return false;

  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");

  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "hex");
    return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
  });
}
