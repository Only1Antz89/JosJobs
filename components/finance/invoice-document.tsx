import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";
import type { FinanceInvoice } from "@/lib/services/admin-finance";
import { formatMoney } from "@/lib/utils";

// The invoice itself, styled as a white page so it prints (or saves as PDF) cleanly.
// Used by the client's invoice page and the admin invoice page.

const STATUS_LABELS: Record<FinanceInvoice["status"], string> = {
  draft: "Draft",
  sent: "Due",
  part_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void"
};

function longDate(value: string) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(value)) : "";
}

function quantityLabel(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function InvoiceDocument({ invoice }: { invoice: FinanceInvoice }) {
  const issuerLines = [env.registeredOffice, env.companyRegistration ? `Company no. ${env.companyRegistration}` : "", env.vatNumber ? `VAT no. ${env.vatNumber}` : ""].filter(Boolean);

  return (
    <article className="invoice-document mx-auto w-full max-w-3xl rounded-[24px] bg-white p-6 text-[#14161a] shadow-sm sm:p-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-2xl font-semibold tracking-tight">{BRAND.plainName}</p>
          {issuerLines.map((line) => (
            <p key={line} className="mt-1 text-sm text-[#5b6170]">
              {line}
            </p>
          ))}
        </div>
        <div className="sm:text-right">
          <p className="text-sm uppercase tracking-[0.18em] text-[#5b6170]">Invoice</p>
          <p className="mt-1 text-2xl font-semibold">{invoice.invoiceNumber}</p>
          <p className="mt-2 inline-block rounded-full border border-[#d8dbe2] px-3 py-1 text-xs font-medium">
            {STATUS_LABELS[invoice.status]}
          </p>
        </div>
      </header>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6170]">Bill to</p>
          <p className="mt-2 font-medium">{invoice.clientName}</p>
          {invoice.billingName ? <p className="text-sm">{invoice.billingName}</p> : null}
          {invoice.billingAddress.map((line) => (
            <p key={line} className="text-sm">
              {line}
            </p>
          ))}
          {invoice.clientVatNumber ? <p className="text-sm">VAT no. {invoice.clientVatNumber}</p> : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:justify-self-end">
          <dt className="text-[#5b6170]">Issued</dt>
          <dd className="text-right">{longDate(invoice.issueDate)}</dd>
          <dt className="text-[#5b6170]">Due</dt>
          <dd className="text-right">{longDate(invoice.dueDate)}</dd>
          <dt className="text-[#5b6170]">Amount due</dt>
          <dd className="text-right font-semibold">{formatMoney(invoice.balance)}</dd>
        </dl>
      </section>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-[#d8dbe2] text-left text-xs uppercase tracking-[0.14em] text-[#5b6170]">
              <th className="py-2 pr-4 font-semibold">Description</th>
              <th className="py-2 pr-4 text-right font-semibold">Hours / qty</th>
              <th className="py-2 pr-4 text-right font-semibold">Rate</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={`${line.description}-${index}`} className="border-b border-[#eef0f4] align-top">
                <td className="py-3 pr-4">{line.description}</td>
                <td className="py-3 pr-4 text-right">{quantityLabel(line.quantity)}</td>
                <td className="py-3 pr-4 text-right">{formatMoney(line.unitAmount)}</td>
                <td className="py-3 text-right">{formatMoney(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto mt-6 grid max-w-xs grid-cols-2 gap-y-2 text-sm">
        <dt className="text-[#5b6170]">Subtotal</dt>
        <dd className="text-right">{formatMoney(invoice.subtotal)}</dd>
        {invoice.taxAmount > 0 ? (
          <>
            <dt className="text-[#5b6170]">VAT</dt>
            <dd className="text-right">{formatMoney(invoice.taxAmount)}</dd>
          </>
        ) : null}
        <dt className="font-semibold">Total</dt>
        <dd className="text-right font-semibold">{formatMoney(invoice.totalAmount)}</dd>
        {invoice.amountPaid > 0 ? (
          <>
            <dt className="text-[#5b6170]">Paid</dt>
            <dd className="text-right">−{formatMoney(invoice.amountPaid)}</dd>
            <dt className="font-semibold">Balance</dt>
            <dd className="text-right font-semibold">{formatMoney(invoice.balance)}</dd>
          </>
        ) : null}
      </dl>

      {invoice.notes ? <p className="mt-8 whitespace-pre-line text-sm text-[#3a3f4b]">{invoice.notes}</p> : null}

      {invoice.balance > 0 && env.hasBankDetails ? (
        <section className="mt-8 rounded-2xl border border-[#d8dbe2] p-4 text-sm">
          <p className="font-semibold">Pay by bank transfer</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt className="text-[#5b6170]">Account name</dt>
            <dd>{env.bankAccountName}</dd>
            <dt className="text-[#5b6170]">Sort code</dt>
            <dd>{env.bankSortCode}</dd>
            <dt className="text-[#5b6170]">Account number</dt>
            <dd>{env.bankAccountNumber}</dd>
            <dt className="text-[#5b6170]">Reference</dt>
            <dd>{invoice.invoiceNumber}</dd>
          </dl>
        </section>
      ) : null}
    </article>
  );
}
