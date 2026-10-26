import Link from "next/link";
import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";
import { ExportButton } from "@/components/admin/export-button";
import { PayoutPanel } from "@/components/admin/finance/payout-panel";
import { UnbilledWork } from "@/components/admin/finance/unbilled-work";
import { KpiGrid } from "@/components/admin/kpi-grid";
import { StatusBadge } from "@/components/admin/status-badge";
import { getRuntimeMode } from "@/lib/env";
import { getAdminFinance } from "@/lib/queries/finance";
import { loadFinanceWorkspace } from "@/lib/services/admin-finance";
import { formatCurrency, formatDate, formatMoney } from "@/lib/utils";

export default async function FinancePage() {
  if (getRuntimeMode() !== "live") {
    return <DemoFinancePage />;
  }

  const finance = await loadFinanceWorkspace();
  const { settings, totals } = finance;
  const missingSetup = [
    !settings.hasBankDetails ? "bank details (ATHENA_BANK_ACCOUNT_NAME, ATHENA_BANK_SORT_CODE, ATHENA_BANK_ACCOUNT_NUMBER)" : null,
    !settings.hasStripe ? "Stripe keys for card payments (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)" : null
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <DetailHeader
          eyebrow="Finance"
          title="Invoices, payments and operator pay"
          description="Invoice finished jobs, send invoices with bank details and a card payment link, record bank payments, and keep track of what operators are owed."
        />
        <ExportButton href="/api/admin/exports/invoices" label="Export invoices (CSV)" />
      </div>

      {missingSetup.length > 0 ? (
        <p className="rounded-[22px] border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-ink">
          Still to set up on the hosting environment: {missingSetup.join("; ")}.
          {settings.vatRate > 0 ? null : " VAT is not being added (ATHENA_VAT_RATE is 0 or unset)."}
        </p>
      ) : null}

      <KpiGrid
        items={[
          { label: "Ready to invoice", value: formatMoney(totals.unbilled), hint: "Finished jobs with a charge rate, not on an invoice yet." },
          { label: "Outstanding", value: formatMoney(totals.outstanding), hint: `Sent and unpaid. ${formatMoney(totals.overdue)} of it is overdue.` },
          { label: "Collected this month", value: formatMoney(totals.collectedThisMonth), hint: "Bank and card payments received this calendar month." },
          { label: "Owed to operators", value: formatMoney(totals.owedToOperators), hint: "Pay earned on finished shifts, minus payouts recorded." }
        ]}
      />

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Ready to invoice</h2>
        <UnbilledWork unbilled={finance.unbilled} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Invoices</h2>
        <AdminDataTable
          emptyLabel="No invoices yet."
          columns={[
            { key: "invoice", label: "Invoice" },
            { key: "client", label: "Client" },
            { key: "status", label: "Status" },
            { key: "due", label: "Due" },
            { key: "total", label: "Total" },
            { key: "balance", label: "Balance" }
          ]}
          rows={finance.invoices.map((invoice) => ({
            id: invoice.id,
            href: `/admin/finance/invoices/${invoice.id}`,
            cells: {
              invoice: (
                <Link className="underline-offset-4 hover:underline" href={`/admin/finance/invoices/${invoice.id}`}>
                  {invoice.invoiceNumber}
                </Link>
              ),
              client: invoice.clientName,
              status: <StatusBadge value={invoice.status} />,
              due: invoice.status === "draft" ? "Not sent" : formatDate(invoice.dueDate),
              total: formatMoney(invoice.totalAmount),
              balance: formatMoney(invoice.balance)
            }
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Operator pay</h2>
        <PayoutPanel balances={finance.operatorBalances} />
        {finance.payouts.length > 0 ? (
          <AdminDataTable
            columns={[
              { key: "operator", label: "Payout" },
              { key: "period", label: "Work period" },
              { key: "amount", label: "Amount" },
              { key: "paid", label: "Paid" },
              { key: "reference", label: "Reference" }
            ]}
            rows={finance.payouts.map((payout) => ({
              id: payout.id,
              cells: {
                operator: payout.operatorName,
                period: `${formatDate(payout.periodStart)} to ${formatDate(payout.periodEnd)}`,
                amount: formatMoney(payout.amount),
                paid: payout.paidAt ? formatDate(payout.paidAt) : "Pending",
                reference: payout.reference || "–"
              }
            }))}
          />
        ) : null}
      </section>
    </div>
  );
}

// Demo mode keeps the sample overview; nothing can be invoiced or paid.
async function DemoFinancePage() {
  const finance = await getAdminFinance();

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Finance"
        title="Billed, collected and outstanding"
        description="Sample data. Invoicing, payments and payouts work once the site is connected to the live database."
      />

      <KpiGrid
        items={[
          { label: "Total billed", value: formatCurrency(finance.totalBilled), hint: "Gross invoiced volume across tracked client accounts." },
          { label: "Collected", value: formatCurrency(finance.totalCollected), hint: "Payments recorded against client invoices." },
          { label: "Outstanding", value: formatCurrency(finance.totalOutstanding), hint: "Open balance requiring follow-up." },
          { label: "Monthly revenue", value: formatCurrency(finance.monthlyRevenue), hint: "Current month revenue." }
        ]}
      />

      <AdminDataTable
        columns={[
          { key: "invoice", label: "Invoice" },
          { key: "status", label: "Status" },
          { key: "due", label: "Due date" },
          { key: "amount", label: "Amount" },
          { key: "balance", label: "Balance" }
        ]}
        rows={finance.outstandingInvoices.map((invoice) => ({
          id: invoice.invoiceId,
          cells: {
            invoice: invoice.invoiceNumber,
            status: <StatusBadge value={invoice.status} />,
            due: formatDate(invoice.dueDate),
            amount: formatCurrency(invoice.totalAmount),
            balance: formatCurrency(invoice.balance)
          }
        }))}
      />
    </div>
  );
}
