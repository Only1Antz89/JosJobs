import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/finance/invoice-document";
import { PrintButton } from "@/components/finance/print-button";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { getRuntimeMode } from "@/lib/env";
import { isStripeEnabled } from "@/lib/payments/stripe";
import { getInvoiceByAccessToken } from "@/lib/services/admin-finance";
import { SITE_CONTACT } from "@/lib/site-content";
import { formatMoney } from "@/lib/utils";

// The client's link from the invoice email. The long random token in the URL is
// the access check, the same way a payment link works.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false }
};

export default async function ClientInvoicePage({
  params,
  searchParams
}: {
  params: { token: string };
  searchParams: { paid?: string; error?: string };
}) {
  if (getRuntimeMode() !== "live") {
    notFound();
  }

  const invoice = await getInvoiceByAccessToken(params.token);
  if (!invoice) {
    notFound();
  }

  const canPayByCard = isStripeEnabled() && invoice.balance > 0;
  const justPaid = searchParams.paid === "1";

  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <Link href="/" className="font-display text-lg font-semibold tracking-[-0.03em] text-ink">
            {BRAND.plainName}
          </Link>
          <div className="flex flex-wrap gap-3">
            <PrintButton />
            {canPayByCard && !justPaid ? (
              <form action={`/api/invoices/${params.token}/checkout`} method="post">
                <Button type="submit">Pay {formatMoney(invoice.balance)} by card</Button>
              </form>
            ) : null}
          </div>
        </div>

        {justPaid ? (
          <p role="status" className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-ink print:hidden">
            Thank you, your payment has been received. It can take a minute to show on this invoice.
          </p>
        ) : null}
        {searchParams.error ? (
          <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-ink print:hidden">
            {searchParams.error.slice(0, 200)}
          </p>
        ) : null}

        <InvoiceDocument invoice={invoice} />

        <p className="text-center text-sm text-slate print:hidden">
          Questions about this invoice? Email{" "}
          <a className="underline" href={`mailto:${SITE_CONTACT.supportEmail}?subject=Invoice ${invoice.invoiceNumber}`}>
            {SITE_CONTACT.supportEmail}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
