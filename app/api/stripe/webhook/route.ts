import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { verifyStripeSignature } from "@/lib/payments/stripe";
import { recordInvoicePayment } from "@/lib/services/admin-finance";

// Stripe calls this when a card payment finishes. Point a Stripe webhook at
// /api/stripe/webhook for checkout.session.completed and
// checkout.session.async_payment_succeeded.

type CheckoutSession = {
  id: string;
  payment_status?: string;
  amount_total?: number;
  currency?: string;
  payment_intent?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
  created?: number;
};

export async function POST(request: Request) {
  if (!env.stripeWebhookSecret) {
    return NextResponse.json({ ok: false, error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), env.stripeWebhookSecret)) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: CheckoutSession } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }

  const handled = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  const session = event.data?.object;

  if (!event.type || !handled.includes(event.type) || !session) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const invoiceId = session.metadata?.invoice_id ?? session.client_reference_id ?? "";
  if (!invoiceId || session.payment_status !== "paid" || (session.currency ?? "gbp") !== "gbp") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await recordInvoicePayment({
      actorId: null,
      invoiceId,
      amount: (session.amount_total ?? 0) / 100,
      paymentDate: new Date((session.created ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10),
      method: "card",
      reference: session.payment_intent ?? session.id
    });
  } catch (error) {
    if (error instanceof AppError && (error.status === 404 || error.status === 409)) {
      // Permanent problem (invoice deleted or voided): retrying won't help, so
      // acknowledge it and leave it for the finance team to refund in Stripe.
      console.error("[athena] Card payment for an invoice that can't take payments", invoiceId, error.message);
      return NextResponse.json({ ok: true, needsAttention: true });
    }
    // A non-2xx makes Stripe retry later, which is what we want for temporary failures.
    console.error("[athena] Stripe payment could not be recorded", invoiceId, error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
