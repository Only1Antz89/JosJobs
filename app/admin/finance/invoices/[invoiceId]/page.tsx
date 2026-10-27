import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";
import { InvoiceActions } from "@/components/admin/finance/invoice-actions";
import { InvoiceDocument } from "@/components/finance/invoice-document";
import { PrintButton } from "@/components/finance/print-button";
import { Button } from "@/components/ui/button";
import { getRuntimeMode } from "@/lib/env";
import { getFinanceSettings, getInvoiceById } from "@/lib/services/admin-finance";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoice" };

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  card: "Card (Stripe)",
  other: "Other"
};

export default async function AdminInvoicePage({ params }: { params: { invoiceId: string } }) {
  if (getRuntimeMode() !== "live") {
    notFound();
  }

  const invoice = await getInvoiceById(params.invoiceId);
  if (!invoice) {
    notFound();
  }

  const host = headers().get("x-forwarded-host") ?? headers().get("host") ?? "";
  const protocol = headers().get("x-forwarded-proto") ?? "https";
  const clientLink = `${protocol}://${host}/invoices/${invoice.accessToken}`;

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Invoice"
        title={`${invoice.invoiceNumber} · ${invoice.clientName}`}
        description={
          invoice.status === "draft"
            ? "Draft. Check the lines below, then send it. The client gets an email with a link to view and pay."
            : `Sent to ${invoice.billingEmail || "the client"}${invoice.sentAt ? ` on ${formatDate(invoice.sentAt)}` : ""}.`
        }
        status={invoice.status}
        meta={`Total ${formatMoney(invoice.totalAmount)} · Balance ${formatMoney(invoice.balance)}`}
        actions={
          <>
            <Link href="/admin/finance">
              <Button variant="secondary">Back to finance</Button>
            </Link>
            <PrintButton />
          </>
        }
      />

      <InvoiceActions invoice={invoice} settings={getFinanceSettings()} clientLink={clientLink} />

      <InvoiceDocument invoice={invoice} />

      {invoice.payments.length > 0 ? (
        <AdminDataTable
          columns={[
            { key: "date", label: "Payment received" },
            { key: "method", label: "Method" },
            { key: "reference", label: "Reference" },
            { key: "amount", label: "Amount" }
          ]}
          rows={invoice.payments.map((payment) => ({
            id: payment.id,
            cells: {
              date: formatDate(payment.paymentDate),
              method: METHOD_LABELS[payment.method] ?? payment.method,
              reference: payment.reference || "–",
              amount: formatMoney(payment.amount)
            }
          }))}
        />
      ) : null}
    </div>
  );
}
