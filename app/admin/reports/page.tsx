import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";
import { ExportButton } from "@/components/admin/export-button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getRuntimeMode } from "@/lib/env";
import { roundMoney } from "@/lib/finance/billing";
import { getAdminExportJobs } from "@/lib/queries/reports";
import { EXPORT_TYPES, type ExportType } from "@/lib/services/admin-exports";
import { loadFinanceWorkspace, type FinanceWorkspace } from "@/lib/services/admin-finance";
import { formatDateTime, formatMoney } from "@/lib/utils";

function monthKey(value: string | null | undefined) {
  return value ? value.slice(0, 7) : "";
}

// Invoiced, collected and paid out per month for the last 12 months.
function monthlySummary(finance: FinanceWorkspace, now = new Date()) {
  const months: string[] = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    months.push(date.toISOString().slice(0, 7));
  }

  const totals = new Map(months.map((month) => [month, { invoiced: 0, collected: 0, paidOut: 0 }]));
  for (const invoice of finance.invoices) {
    if (invoice.status === "draft" || invoice.status === "void") continue;
    const entry = totals.get(monthKey(invoice.issueDate));
    if (entry) entry.invoiced = roundMoney(entry.invoiced + invoice.totalAmount);
    for (const payment of invoice.payments) {
      const paymentEntry = totals.get(monthKey(payment.paymentDate));
      if (paymentEntry) paymentEntry.collected = roundMoney(paymentEntry.collected + payment.amount);
    }
  }
  for (const payout of finance.payouts) {
    const entry = totals.get(monthKey(payout.paidAt));
    if (entry) entry.paidOut = roundMoney(entry.paidOut + payout.amount);
  }

  return months.reverse().map((month) => ({ month, ...totals.get(month)! }));
}

export default async function ReportsPage() {
  const { adminUser } = await requireAdmin();
  const live = getRuntimeMode() === "live";
  const canSeeFinance = adminUser.adminRole === "super_admin" || adminUser.adminRole === "finance_admin";
  const [exports, finance] = await Promise.all([
    getAdminExportJobs(),
    live && canSeeFinance ? loadFinanceWorkspace() : Promise.resolve(null)
  ]);

  const exportTypes = (Object.keys(EXPORT_TYPES) as ExportType[]).filter(
    (type) => !EXPORT_TYPES[type].finance || (canSeeFinance && live)
  );

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Reports and exports"
        title="Monthly figures and spreadsheet downloads"
        description="Download any list as a CSV for Excel, Google Sheets or your accountant. Every download is logged below."
      />

      <Card className="rounded-[28px] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">Download CSV</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {exportTypes.map((type) => (
            <ExportButton key={type} href={`/api/admin/exports/${type}`} label={EXPORT_TYPES[type].label} />
          ))}
        </div>
      </Card>

      {finance ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ink">Last 12 months</h2>
          <AdminDataTable
            columns={[
              { key: "month", label: "Month" },
              { key: "invoiced", label: "Invoiced" },
              { key: "collected", label: "Collected" },
              { key: "paidOut", label: "Paid to operators" }
            ]}
            rows={monthlySummary(finance).map((row) => ({
              id: row.month,
              cells: {
                month: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
                  new Date(`${row.month}-01T00:00:00Z`)
                ),
                invoiced: formatMoney(row.invoiced),
                collected: formatMoney(row.collected),
                paidOut: formatMoney(row.paidOut)
              }
            }))}
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Download history</h2>
        <AdminDataTable
          emptyLabel="No downloads yet."
          columns={[
            { key: "type", label: "Export" },
            { key: "format", label: "Format" },
            { key: "requested", label: "Downloaded" }
          ]}
          rows={exports.map((job) => ({
            id: job.id,
            cells: {
              type: EXPORT_TYPES[job.exportType as ExportType]?.label ?? job.exportType,
              format: job.format.toUpperCase(),
              requested: `${job.requestedBy} • ${formatDateTime(job.createdAt)}`
            }
          }))}
        />
      </section>
    </div>
  );
}
