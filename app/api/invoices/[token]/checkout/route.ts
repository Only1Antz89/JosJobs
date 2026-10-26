import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { createInvoiceCheckoutSession, isStripeEnabled } from "@/lib/payments/stripe";
import { getInvoiceByAccessToken } from "@/lib/services/admin-finance";

// "Pay by card" on the client's invoice page. Sends them to Stripe's hosted
// checkout for the invoice's current balance.
export async function POST(request: Request, { params }: { params: { token: string } }) {
  const origin = new URL(request.url).origin;
  const invoicePage = `${origin}/invoices/${params.token}`;

  try {
    if (!isStripeEnabled()) {
      throw new AppError("Card payments are not available yet. Please pay by bank transfer.", "STRIPE_DISABLED", 503);
    }

    const invoice = await getInvoiceByAccessToken(params.token);
    if (!invoice) {
      return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
    }
    if (invoice.balance <= 0) {
      return NextResponse.redirect(`${invoicePage}?paid=1`, 303);
    }

    const session = await createInvoiceCheckoutSession({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amountPence: Math.round(invoice.balance * 100),
      customerEmail: invoice.billingEmail,
      successUrl: `${invoicePage}?paid=1`,
      cancelUrl: invoicePage
    });

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Card payment could not be started.";
    if (!(error instanceof AppError)) console.error("[athena] checkout failed", error);
    return NextResponse.redirect(`${invoicePage}?error=${encodeURIComponent(message)}`, 303);
  }
}
