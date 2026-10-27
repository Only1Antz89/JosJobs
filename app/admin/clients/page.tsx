import type { Metadata } from "next";
import Link from "next/link";
import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";
import { ExportButton } from "@/components/admin/export-button";
import { FilterToolbar } from "@/components/admin/filters-bar";
import { StatusBadge } from "@/components/admin/status-badge";
import { getAdminClients } from "@/lib/queries/clients";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Clients" };

export default async function AdminClientsPage() {
  const clients = await getAdminClients();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <DetailHeader
          eyebrow="Client management"
          title="Accounts, spend, balances, and repeat-booking health"
          description="Client detail is layered around operational history, billing exposure, and matching signals for repeat operators."
        />
        <ExportButton href="/api/admin/clients" label="Export clients" />
      </div>

      <FilterToolbar
        title="Status, spend range, outstanding balance, signup date, active or inactive"
        items={[
          { label: "Status", value: "All" },
          { label: "Spend", value: "Any" },
          { label: "Outstanding", value: "Tracked" },
          { label: "Signup", value: "Rolling 12 months" },
          { label: "Activity", value: "All" }
        ]}
      />

      <AdminDataTable
        columns={[
          { key: "company", label: "Client" },
          { key: "status", label: "Status" },
          { key: "assignments", label: "Assignments" },
          { key: "spend", label: "Lifetime spend" },
          { key: "balance", label: "Outstanding" },
          { key: "repeat", label: "Repeat rate" }
        ]}
        rows={clients.map((client) => ({
          id: client.id,
          cells: {
            company: (
              <div>
                <Link href={`/admin/clients/${client.id}`} className="font-medium text-ink hover:text-mist">
                  {client.companyName}
                </Link>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate">
                  {client.primaryContactName} • joined {formatDate(client.signupDate)}
                </p>
                <p className="mt-2">
                  <Link
                    href={`/admin/clients/${client.id}/workspace`}
                    className="text-xs font-semibold uppercase tracking-[0.16em] text-mist hover:text-ink"
                  >
                    View client workspace
                  </Link>
                </p>
              </div>
            ),
            status: (
              <div className="space-y-2">
                <StatusBadge value={client.status} />
                <div>
                  <StatusBadge value={client.onboardingStatus} />
                </div>
              </div>
            ),
            assignments: `${client.activeAssignments} active / ${client.futureAssignments} future`,
            spend: formatCurrency(client.lifetimeSpend),
            balance: formatCurrency(client.outstandingBalance),
            repeat: `${client.repeatBookingRate}%`
          }
        }))}
      />
    </div>
  );
}
