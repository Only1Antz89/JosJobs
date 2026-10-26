import Link from "next/link";
import { DetailHeader } from "@/components/admin/detail-header";
import { InsightCard } from "@/components/admin/insight-card";
import { KpiGrid } from "@/components/admin/kpi-grid";
import { AdminManagementWorkspace } from "@/components/admin/management-workspace";
import { RankingBadge } from "@/components/admin/ranking-badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { getRuntimeMode } from "@/lib/env";
import { getAdminDataset } from "@/lib/queries/admin-dataset";
import { formatCurrency } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const data = await getAdminDataset();
  const clientDetails = Object.values(data.clientDetails);
  const operatorDetails = Object.values(data.operatorDetails);

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Operations dashboard"
        title="Management desk and executive visibility"
        description="Search clients and operators, manage lifecycle state, and keep the wider operational, finance, onboarding, and ranking signals in view."
        meta="Live clients, operators and lifecycle controls"
        actions={
          <>
            <Link href="/admin/clients">
              <Button variant="secondary">View client pages</Button>
            </Link>
            <Link href="/admin/operators">
              <Button variant="secondary">View operator pages</Button>
            </Link>
          </>
        }
      />

      <AdminManagementWorkspace
        initialClients={clientDetails}
        initialOperators={operatorDetails}
        live={getRuntimeMode() === "live"}
      />

      <KpiGrid
        items={[
          {
            label: "Total clients",
            value: data.dashboard.kpis.totalClients,
            hint: `${data.dashboard.kpis.activeClients} active accounts currently spending on the platform.`,
            trend: 12
          },
          {
            label: "Total operators",
            value: data.dashboard.kpis.totalOperators,
            hint: `${data.dashboard.kpis.verifiedOperators} verified for live deployment.`,
            trend: 8
          },
          {
            label: "Monthly revenue",
            value: formatCurrency(data.dashboard.kpis.monthlyRevenue),
            hint: `Outstanding balances currently sit at ${formatCurrency(data.dashboard.kpis.outstandingBalances)}.`,
            trend: 9
          },
          {
            label: "Repeat booking rate",
            value: `${data.dashboard.kpis.repeatBookingRate}%`,
            hint: `${data.dashboard.kpis.topClient} and ${data.dashboard.kpis.topOperator} are leading the network.`,
            trend: 4
          }
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <InsightCard
          title="Assignments over time"
          description="Current operational mix by status. This is the at-a-glance fill-pressure view."
        >
          <div className="space-y-4">
            {data.dashboard.assignmentSeries.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-ink">{item.label}</span>
                  <span className="text-slate">{item.value}</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.05]">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-mist to-accent"
                    style={{ width: `${Math.max((item.value / 6) * 100, 12)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </InsightCard>

        <InsightCard
          title="Revenue over time"
          description="Four-month snapshot used to benchmark the current billing run-rate."
        >
          <div className="grid grid-cols-4 gap-3">
            {data.dashboard.revenueSeries.map((item) => (
              <div key={item.label} className="rounded-[22px] bg-white/[0.03] p-4">
                <div className="flex h-28 items-end">
                  <div
                    className="w-full rounded-t-[16px] bg-gradient-to-t from-accent to-mist"
                    style={{ height: `${Math.max((item.value / 16000) * 100, 10)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate">{item.label}</p>
                <p className="mt-1 text-sm font-medium text-ink">{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
        </InsightCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <InsightCard title="Top clients by spend" description="Commercial leaders ranked by lifetime billed value.">
          <div className="space-y-3">
            {data.dashboard.topClients.map((client, index) => (
              <div
                key={client.clientId}
                className="flex items-center justify-between gap-3 rounded-[20px] bg-white/[0.03] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {index + 1}. {client.companyName}
                  </p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate">Client account</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-ink">{formatCurrency(client.totalSpend)}</p>
                  <Link href={`/admin/clients/${client.clientId}`}>
                    <Button variant="secondary" className="px-4 py-2">
                      View page
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </InsightCard>

        <InsightCard title="Top operators" description="Ranking scores blend rating quality, delivery history, and client preference signals.">
          <div className="space-y-3">
            {data.dashboard.topOperators.map((operator) => (
              <div
                key={operator.operatorId}
                className="flex items-center justify-between gap-3 rounded-[20px] bg-white/[0.03] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{operator.displayName}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate">
                    Avg rating {operator.averageRating.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <RankingBadge score={operator.rankingScore} />
                  <Link href={`/admin/operators/${operator.operatorId}`}>
                    <Button variant="secondary" className="px-4 py-2">
                      View page
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </InsightCard>

        <InsightCard title="Operational alerts" description="Issues that deserve an admin decision before they become support noise.">
          <div className="space-y-3">
            {data.dashboard.alerts.map((alert) => (
              <Link key={alert.id} href={alert.href} className="block rounded-[20px] bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">{alert.label}</p>
                  <StatusBadge value={alert.severity} />
                </div>
                <p className="mt-2 text-sm text-slate">{alert.context}</p>
              </Link>
            ))}
          </div>
        </InsightCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <InsightCard title="Overdue balances" description="Finance risk ordered by current open balance.">
          <div className="space-y-3">
            {data.dashboard.overdueBalances.map((invoice) => (
              <div key={invoice.invoiceId} className="flex items-center justify-between rounded-[20px] bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{invoice.invoiceNumber}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate">Due {new Date(invoice.dueDate).toLocaleDateString("en-GB")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink">{formatCurrency(invoice.balance)}</p>
                  <StatusBadge value={invoice.status} />
                </div>
              </div>
            ))}
          </div>
        </InsightCard>

        <InsightCard title="Onboarding pending review" description="Newest manual onboarding items needing operations or compliance handling.">
          <div className="space-y-3">
            {data.dashboard.onboardingQueue.map((item) => (
              <div key={item.id} className="rounded-[20px] bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{item.entityName}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate">
                      {item.entityType} • {item.owner}
                    </p>
                  </div>
                  <StatusBadge value={item.status} />
                </div>
              </div>
            ))}
          </div>
        </InsightCard>
      </div>
    </div>
  );
}
