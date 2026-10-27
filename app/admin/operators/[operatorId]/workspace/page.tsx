import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailHeader } from "@/components/admin/detail-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { getAdminOperatorById } from "@/lib/queries/operators";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Operator workspace" };

const ACTIVE_ASSIGNMENT_STATUSES = new Set(["open", "partially_filled", "filled", "in_progress"]);

export default async function OperatorWorkspacePreviewPage({
  params
}: {
  params: { operatorId: string };
}) {
  const operator = await getAdminOperatorById(params.operatorId);

  if (!operator) {
    notFound();
  }

  const activeAssignments = operator.assignments.filter((assignment) =>
    ACTIVE_ASSIGNMENT_STATUSES.has(assignment.status)
  );
  const upcomingAssignments = operator.assignments.filter(
    (assignment) => new Date(assignment.startsAt).getTime() > Date.now()
  );

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Operator workspace preview"
        title={`${operator.displayName} workspace`}
        description="Read-only admin view of the operator-facing workspace. Use this to inspect readiness, deployment history, and profile quality without signing in as the operator."
        status={operator.verificationStatus}
        meta={operator.email}
        actions={
          <>
            <Link href={`/admin/operators/${operator.id}`}>
              <Button variant="secondary">Back to operator record</Button>
            </Link>
            <Badge variant="accent">Read-only preview</Badge>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active assignments"
          value={activeAssignments.length}
          hint="Open, filled, and currently in-progress work attached to this operator."
        />
        <StatCard
          label="Upcoming shifts"
          value={upcomingAssignments.length}
          hint="Future deployment windows already visible in the operator journey."
        />
        <StatCard
          label="Completed assignments"
          value={operator.totalCompleted}
          hint="Historical delivery volume used in quality and ranking views."
        />
        <StatCard
          label="Earnings YTD"
          value={formatCurrency(operator.earningsYtd)}
          hint="Current year tracked earnings across assigned work."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
                Deployment timeline
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-ink">Assignments and recent work</h3>
            </div>
            <Badge variant="neutral">{activeAssignments.length} active</Badge>
          </div>
          <div className="mt-6 space-y-4">
            {operator.assignments.slice(0, 6).map((assignment) => (
              <div key={assignment.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-ink">{assignment.title}</p>
                    <p className="mt-2 text-sm text-slate">
                      {assignment.clientName} • {assignment.locationName}
                    </p>
                    <p className="mt-1 text-sm text-slate">
                      {formatDateTime(assignment.startsAt)} to {formatDateTime(assignment.endsAt)}
                    </p>
                  </div>
                  <StatusBadge value={assignment.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate">
                  <span>{assignment.roleType}</span>
                  <span>{assignment.durationHours} hrs</span>
                  <span>{formatCurrency(assignment.payRate)}/hr</span>
                  <span>{formatCurrency(assignment.totalPayAmount)} total pay</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Profile snapshot</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Readiness and positioning</h3>
            <div className="mt-6 space-y-4 text-sm text-slate">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate/80">Coverage</p>
                <p className="mt-2 text-base font-medium text-ink">{operator.regions.join(", ")}</p>
                <p className="mt-2 leading-6">{operator.skillTags.join(", ") || "General operational coverage"}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate/80">Workspace health</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge value={operator.onboardingStatus} />
                  <Badge variant={operator.isActive ? "success" : "warning"}>
                    {operator.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="neutral">{operator.repeatClients} repeat clients</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="neutral">{operator.favouriteCount} favourites</Badge>
                  <Badge variant="neutral">{operator.blockedCount} blocks</Badge>
                  <Badge variant="neutral">{operator.complaintCount} complaints</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Compliance</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Documents and verification</h3>
            <div className="mt-6 space-y-3">
              {operator.documents.map((document) => (
                <div
                  key={document.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4"
                >
                  <div>
                    <p className="font-medium text-ink">{document.documentType}</p>
                    <p className="mt-1 text-sm text-slate">
                      {document.reviewedAt ? `Reviewed ${formatDateTime(document.reviewedAt)}` : "Awaiting review"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {document.expiresAt ? <Badge variant="neutral">Expires {document.expiresAt}</Badge> : null}
                    <StatusBadge value={document.verificationStatus} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Performance</p>
          <h3 className="mt-3 text-2xl font-semibold text-ink">Quality signals visible to admin</h3>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate/80">Average rating</p>
              <p className="mt-3 text-3xl font-semibold text-ink">{operator.averageRating.toFixed(2)}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate/80">Completion rate</p>
              <p className="mt-3 text-3xl font-semibold text-ink">{operator.completionRate}%</p>
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Internal notes</p>
          <h3 className="mt-3 text-2xl font-semibold text-ink">Signals attached to the operator</h3>
          <div className="mt-6 space-y-3">
            {operator.notes.map((note) => (
              <div
                key={note}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-slate"
              >
                {note}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
