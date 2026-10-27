import type { Metadata } from "next";
import Link from "next/link";
import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";
import { ExportButton } from "@/components/admin/export-button";
import { FilterToolbar } from "@/components/admin/filters-bar";
import { StatusBadge } from "@/components/admin/status-badge";
import { getAdminAssignments } from "@/lib/queries/assignments";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Assignments" };

export default async function AssignmentsPage() {
  const assignments = await getAdminAssignments();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <DetailHeader
          eyebrow="Assignment management"
          title="Open, future, past, filled, and at-risk assignments"
          description="Assignment operations focus on fill rate, client history, matching efficiency, and manual intervention points."
        />
        <ExportButton href="/api/admin/assignments" label="Export assignments" />
      </div>

      <FilterToolbar
        title="Date range, current or past, client, status, and location"
        items={[
          { label: "Date range", value: "Rolling 30 days" },
          { label: "Window", value: "All" },
          { label: "Client", value: "Any" },
          { label: "Status", value: "Tracked" },
          { label: "Location", value: "All" }
        ]}
      />

      <AdminDataTable
        columns={[
          { key: "assignment", label: "Assignment" },
          { key: "status", label: "Status" },
          { key: "headcount", label: "Headcount" },
          { key: "applicants", label: "Applicants" },
          { key: "financials", label: "Financials" }
        ]}
        rows={assignments.map((assignment) => ({
          id: assignment.id,
          cells: {
            assignment: (
              <div>
                <Link href={`/admin/assignments/${assignment.id}`} className="font-medium text-ink hover:text-mist">
                  {assignment.title}
                </Link>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate">
                  {assignment.clientName} • {formatDateTime(assignment.startsAt)}
                </p>
              </div>
            ),
            status: <StatusBadge value={assignment.status} />,
            headcount: `${assignment.assignedHeadcount} / ${assignment.requiredHeadcount}`,
            applicants: assignment.applicantCount,
            financials: `${formatCurrency(assignment.totalChargeAmount)} / ${formatCurrency(assignment.totalPayAmount)}`
          }
        }))}
      />
    </div>
  );
}
