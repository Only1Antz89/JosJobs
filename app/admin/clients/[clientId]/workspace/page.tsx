import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailHeader } from "@/components/admin/detail-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { getAdminClientById } from "@/lib/queries/clients";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Client workspace" };

const ACTIVE_ASSIGNMENT_STATUSES = new Set(["open", "partially_filled", "filled", "in_progress"]);

export default async function ClientWorkspacePreviewPage({
  params
}: {
  params: { clientId: string };
}) {
  const client = await getAdminClientById(params.clientId);

  if (!client) {
    notFound();
  }

  const activeAssignments = client.assignments.filter((assignment) =>
    ACTIVE_ASSIGNMENT_STATUSES.has(assignment.status)
  );
  const completedAssignments = client.assignments.filter((assignment) => assignment.status === "completed");
  const pendingApplicants = client.assignments.reduce(
    (total, assignment) => total + Math.max(assignment.applicantCount - assignment.assignedHeadcount, 0),
    0
  );
  const totalCollected = client.paymentHistory.reduce((total, payment) => total + payment.amount, 0);
  const latestPayment = client.paymentHistory[0] ?? null;

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Client workspace preview"
        title={`${client.companyName} workspace`}
        description="Read-only admin view of the client-facing workspace. Use this to inspect the account journey without signing in as the client."
        status={client.status}
        meta={`${client.primaryContactName} • ${client.primaryContactEmail}`}
        actions={
          <>
            <Link href={`/admin/clients/${client.id}`}>
              <Button variant="secondary">Back to client record</Button>
            </Link>
            <Badge variant="accent">Read-only preview</Badge>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active assignments"
          value={activeAssignments.length}
          hint="Open, partially filled, filled, and currently in-progress work."
        />
        <StatCard
          label="Pending requests"
          value={pendingApplicants}
          hint="Applicant decisions still waiting inside the client pipeline."
        />
        <StatCard
          label="Outstanding balance"
          value={formatCurrency(client.outstandingBalance)}
          hint="Current exposure across the account's tracked finance summary."
        />
        <StatCard
          label="Repeat operators"
          value={client.preferredOperators.length}
          hint="Preferred operator relationships retained for the account."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
                Live delivery schedule
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-ink">Assignments and staffing pipeline</h3>
            </div>
            <Badge variant="neutral">{activeAssignments.length} active</Badge>
          </div>
          <div className="mt-6 space-y-4">
            {client.assignments.slice(0, 6).map((assignment) => (
              <div key={assignment.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-ink">{assignment.title}</p>
                    <p className="mt-2 text-sm text-slate">
                      {assignment.locationName} • {formatDateTime(assignment.startsAt)} to{" "}
                      {formatDateTime(assignment.endsAt)}
                    </p>
                  </div>
                  <StatusBadge value={assignment.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate">
                  <span>{assignment.assignedHeadcount} assigned</span>
                  <span>{assignment.applicantCount} applicants</span>
                  <span>{formatCurrency(assignment.totalChargeAmount)} charge</span>
                  <span>{formatCurrency(assignment.totalPayAmount)} pay</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Account snapshot</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Primary workspace context</h3>
            <div className="mt-6 space-y-4 text-sm text-slate">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate/80">Primary contact</p>
                <p className="mt-2 text-base font-medium text-ink">{client.primaryContactName}</p>
                <p className="mt-1">{client.primaryContactEmail}</p>
                <p className="mt-1">{client.primaryContactPhone}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate/80">Billing contact</p>
                <p className="mt-2 text-base font-medium text-ink">{client.billingContactName}</p>
                <p className="mt-1">{client.billingContactEmail}</p>
                <p className="mt-1">{client.billingContactPhone}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate/80">Workspace health</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge value={client.onboardingStatus} />
                  <Badge variant="neutral">Joined {formatDate(client.signupDate)}</Badge>
                  <Badge variant="neutral">{completedAssignments.length} completed assignments</Badge>
                </div>
                <p className="mt-3 leading-6">{client.address}</p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Internal notes</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Signals attached to the account</h3>
            <div className="mt-6 space-y-3">
              {client.notes.map((note) => (
                <div key={note} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-slate">
                  {note}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Finance view</p>
              <h3 className="mt-3 text-2xl font-semibold text-ink">Recent payment activity</h3>
            </div>
            <Badge variant={client.outstandingBalance > 0 ? "warning" : "success"}>
              {client.outstandingBalance > 0 ? "Balance due" : "Settled"}
            </Badge>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate/80">Collected</p>
              <p className="mt-3 text-3xl font-semibold text-ink">{formatCurrency(totalCollected)}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate/80">Latest payment</p>
              <p className="mt-3 text-base font-semibold text-ink">
                {latestPayment ? formatCurrency(latestPayment.amount) : "No payments logged"}
              </p>
              <p className="mt-1 text-sm text-slate">
                {latestPayment ? formatDate(latestPayment.paymentDate) : "Finance history will appear here."}
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {client.paymentHistory.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div>
                  <p className="font-medium text-ink">{payment.externalReference}</p>
                  <p className="mt-1 text-sm text-slate">
                    {payment.paymentMethod} • {formatDate(payment.paymentDate)}
                  </p>
                </div>
                <p className="text-base font-semibold text-ink">{formatCurrency(payment.amount)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Preferred network</p>
              <h3 className="mt-3 text-2xl font-semibold text-ink">Operator relationships</h3>
            </div>
            <Badge variant="accent">{client.repeatBookingRate}% repeat rate</Badge>
          </div>
          <div className="mt-6 space-y-3">
            {client.preferredOperators.map((operator) => (
              <div key={operator.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div>
                  <p className="font-medium text-ink">{operator.displayName}</p>
                  <p className="mt-1 text-sm text-slate">
                    {operator.skillTags.slice(0, 3).join(", ") || "General deployment coverage"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{operator.averageRating.toFixed(2)} rating</Badge>
                  <StatusBadge value={operator.verificationStatus} />
                </div>
              </div>
            ))}
            {client.blockedOperatorProfiles.length > 0 ? (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate/80">Blocked operators</p>
                <p className="mt-3 text-sm leading-6 text-slate">
                  {client.blockedOperatorProfiles.map((operator) => operator.displayName).join(", ")}
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
