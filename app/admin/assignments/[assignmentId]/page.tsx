import { notFound } from "next/navigation";
import { AuditTimeline } from "@/components/admin/audit-timeline";
import { ChargeRateForm } from "@/components/admin/charge-rate-form";
import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { TabbedDetailLayout } from "@/components/admin/tabbed-detail-layout";
import { getRuntimeMode } from "@/lib/env";
import { getAdminAssignmentById } from "@/lib/queries/assignments";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function AssignmentDetailPage({
  params
}: {
  params: { assignmentId: string };
}) {
  const assignment = await getAdminAssignmentById(params.assignmentId);

  if (!assignment) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Assignment detail"
        title={assignment.title}
        description={assignment.description}
        status={assignment.status}
        meta={`${assignment.clientName} • ${assignment.locationName}`}
      />

      <TabbedDetailLayout
        tabs={[
          { label: "Summary", href: "#summary" },
          { label: "Applicants", href: "#applicants" },
          { label: "Assigned team", href: "#team" },
          { label: "Feedback", href: "#feedback" },
          { label: "Financials", href: "#financials" },
          { label: "Audit", href: "#audit" }
        ]}
      >
        <section id="summary">
          <AdminDataTable
            columns={[
              { key: "field", label: "Field" },
              { key: "value", label: "Value" }
            ]}
            rows={[
              { id: "client", cells: { field: "Client", value: assignment.clientName } },
              { id: "timing", cells: { field: "Timing", value: `${formatDateTime(assignment.startsAt)} to ${formatDateTime(assignment.endsAt)}` } },
              { id: "headcount", cells: { field: "Headcount", value: `${assignment.assignedHeadcount} / ${assignment.requiredHeadcount}` } },
              { id: "repeat", cells: { field: "Repeat operators available", value: assignment.repeatOperatorsAvailable } }
            ]}
          />
        </section>

        <section id="applicants">
          <AdminDataTable
            columns={[
              { key: "operator", label: "Applicant" },
              { key: "status", label: "Status" },
              { key: "rating", label: "Rating" }
            ]}
            rows={assignment.applicants.map((applicant) => ({
              id: applicant.operatorId,
              cells: {
                operator: applicant.operatorName,
                status: <StatusBadge value={applicant.status} />,
                rating: applicant.rating.toFixed(2)
              }
            }))}
          />
        </section>

        <section id="team">
          <AdminDataTable
            columns={[
              { key: "operator", label: "Assigned operator" },
              { key: "verification", label: "Verification" },
              { key: "notes", label: "Signal" }
            ]}
            rows={assignment.assignedTeam.map((operator) => ({
              id: operator.id,
              cells: {
                operator: operator.displayName,
                verification: <StatusBadge value={operator.verificationStatus} />,
                notes: operator.notes[0]
              }
            }))}
          />
        </section>

        <section id="feedback">
          <AdminDataTable
            columns={[
              { key: "operator", label: "Operator" },
              { key: "rating", label: "Rating" },
              { key: "review", label: "Review" }
            ]}
            rows={assignment.feedback.map((item, index) => ({
              id: `${item.operatorName}-${index}`,
              cells: {
                operator: item.operatorName,
                rating: item.rating,
                review: item.reviewText
              }
            }))}
          />
        </section>

        <section id="financials" className="space-y-4">
          <ChargeRateForm
            assignmentId={assignment.id}
            chargeRate={assignment.chargeRate}
            payRate={assignment.payRate}
            live={getRuntimeMode() === "live"}
          />
          <AdminDataTable
            columns={[
              { key: "field", label: "Field" },
              { key: "value", label: "Value" }
            ]}
            rows={[
              { id: "charge", cells: { field: "Charge amount", value: formatCurrency(assignment.totalChargeAmount) } },
              { id: "pay", cells: { field: "Pay amount", value: formatCurrency(assignment.totalPayAmount) } },
              { id: "fill", cells: { field: "Fill rate", value: `${Math.round(assignment.fillRate * 100)}%` } }
            ]}
          />
        </section>

        <section id="audit">
          <AuditTimeline entries={assignment.auditEntries} />
        </section>
      </TabbedDetailLayout>
    </div>
  );
}
