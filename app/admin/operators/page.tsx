import type { Metadata } from "next";
import Link from "next/link";
import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";
import { ExportButton } from "@/components/admin/export-button";
import { FilterToolbar } from "@/components/admin/filters-bar";
import { StatusBadge } from "@/components/admin/status-badge";
import { getAdminOperators } from "@/lib/queries/operators";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Operators" };

export default async function OperatorsPage() {
  const operators = await getAdminOperators();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <DetailHeader
          eyebrow="Operator management"
          title="Verification, quality, complaints, repeat clients, and earnings"
          description="Operators are ranked for deployment quality while surfacing risk signals like compliance gaps, no-shows, and block counts."
        />
        <ExportButton href="/api/admin/operators" label="Export operators" />
      </div>

      <FilterToolbar
        title="Verification status, onboarding state, region, rating, active or inactive"
        items={[
          { label: "Verification", value: "All" },
          { label: "Onboarding", value: "Tracked" },
          { label: "Region", value: "All regions" },
          { label: "Rating", value: "Any" },
          { label: "Active", value: "All" }
        ]}
      />

      <AdminDataTable
        columns={[
          { key: "operator", label: "Operator" },
          { key: "status", label: "Status" },
          { key: "regions", label: "Regions" },
          { key: "performance", label: "Performance" },
          { key: "earnings", label: "Earnings" }
        ]}
        rows={operators.map((operator) => ({
          id: operator.id,
          cells: {
            operator: (
              <div>
                <Link href={`/admin/operators/${operator.id}`} className="font-medium text-ink hover:text-mist">
                  {operator.displayName}
                </Link>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate">
                  {operator.skillTags.slice(0, 2).join(", ")}
                </p>
                <p className="mt-2">
                  <Link
                    href={`/admin/operators/${operator.id}/workspace`}
                    className="text-xs font-semibold uppercase tracking-[0.16em] text-mist hover:text-ink"
                  >
                    View operator workspace
                  </Link>
                </p>
              </div>
            ),
            status: (
              <div className="space-y-2">
                <StatusBadge value={operator.verificationStatus} />
                <div>
                  <StatusBadge value={operator.onboardingStatus} />
                </div>
              </div>
            ),
            regions: operator.regions.join(", "),
            performance: `${operator.averageRating.toFixed(2)} rating • ${operator.totalCompleted} completed`,
            earnings: formatCurrency(operator.earningsYtd)
          }
        }))}
      />
    </div>
  );
}
