"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ClientInvoicesCard } from "@/features/organiser/client-invoices-card";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { NotificationsList } from "@/components/ui/notifications-list";
import { PerformanceBar } from "@/components/ui/performance-bar";
import { Select } from "@/components/ui/select";
import { StarInput } from "@/components/ui/star-input";
import { StatCard } from "@/components/ui/stat-card";
import { Textarea } from "@/components/ui/textarea";
import { useQueryState } from "@/features/app/use-query-state";
import { useStaffBook } from "@/features/app/use-staffbook";
import { formatApplicationStatus, formatStatusLabel } from "@/lib/brand";
import { toDisplayError } from "@/lib/errors";
import { createJobSchema, operatorReviewSchema, updateMarketingPreferencesSchema } from "@/lib/validation/schemas";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { EnrichedApplication, JobStatus, ReviewQueueItem } from "@/types/domain";

export function OrganiserDashboard() {
  const router = useRouter();
  const { provider, session, loading, refreshSession } = useStaffBook();
  const [jobForm, setJobForm] = useState({
    eventId: "",
    title: "",
    description: "",
    roleType: "",
    shiftStart: "",
    shiftEnd: "",
    payRate: "15",
    positionsNeeded: "2",
    minimumAge: "18"
  });
  const [reviewForm, setReviewForm] = useState({
    eventId: "",
    staffId: "",
    jobId: "",
    reliabilityScore: 5,
    professionalismScore: 5,
    communicationScore: 5,
    customerServiceScore: 5,
    pressureHandlingScore: 5,
    comment: ""
  });
  const [marketingConsent, setMarketingConsent] = useState({
    newsletterConsent: false,
    offersConsent: false,
    productUpdatesConsent: false
  });

  const dashboard = useQueryState(() => provider.getOrganiserDashboard(), [provider, session?.userId]);

  const selectedReviewContext = useMemo(
    () =>
      dashboard.data?.ratingQueue.find(
        (item: ReviewQueueItem) =>
          item.event.id === reviewForm.eventId &&
          item.staff.id === reviewForm.staffId &&
          item.job.id === reviewForm.jobId
      ) ?? null,
    [dashboard.data?.ratingQueue, reviewForm]
  );

  useEffect(() => {
    if (!dashboard.data) {
      return;
    }

    setMarketingConsent({
      newsletterConsent: dashboard.data.marketingPreference.newsletterOptIn,
      offersConsent: dashboard.data.marketingPreference.offersOptIn,
      productUpdatesConsent: dashboard.data.marketingPreference.productUpdatesOptIn
    });
  }, [dashboard.data]);

  if (loading || dashboard.loading) {
    return (
      <main>
        <SiteHeader />
        <DashboardShell
          eyebrow="Company workspace"
          title="Loading workspace"
          description="Preparing jobs and active deployment decisions."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <LoadingPanel key={index} />
            ))}
          </div>
        </DashboardShell>
      </main>
    );
  }

  if (!session || session.role !== "organiser") {
    return (
      <main>
        <SiteHeader />
        <DashboardShell
          eyebrow="Company workspace"
          title="Sign in required"
          description="This workspace is available only to company accounts."
        >
          <EmptyState
            title="Sign in as a company"
            description="Use platform access to open a company workspace."
            action={
              <Link href="/auth/login">
                <Button>Platform access</Button>
              </Link>
            }
          />
        </DashboardShell>
      </main>
    );
  }

  if (dashboard.error || !dashboard.data) {
    return (
      <main>
        <SiteHeader />
        <DashboardShell
          eyebrow="Company workspace"
          title="Workspace unavailable"
          description={dashboard.error ?? "Unable to load the company workspace."}
        >
          <EmptyState
            title="Retry loading"
            description="The workspace data did not resolve cleanly."
            action={<Button onClick={() => router.refresh()}>Refresh</Button>}
          />
        </DashboardShell>
      </main>
    );
  }

  return (
    <main>
      <SiteHeader />
      <DashboardShell
        eyebrow="Company workspace"
        title={`Welcome back, ${dashboard.data.profile.fullName}`}
        description={`${dashboard.data.organization.name}: jobs, requests, reviews, and field-team suggestions.`}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Upcoming engagements"
            value={dashboard.data.stats.upcomingEvents}
            hint="Published engagements still to be delivered."
          />
          <StatCard
            label="Live jobs"
            value={dashboard.data.stats.activeJobs}
            hint="Current briefs visible to the Athena network."
          />
          <StatCard
            label="Pending requests"
            value={dashboard.data.stats.pendingApplicants}
            hint="Field-team requests waiting for a decision."
          />
          <StatCard
            label="Completed engagements"
            value={dashboard.data.stats.completedEvents}
            hint="Delivered work now eligible for structured operator review."
          />
        </div>

        <ClientInvoicesCard />

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
                    Engagements
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-ink">Your live delivery schedule</h2>
                </div>
                <Link href="/events/new">
                  <Button variant="secondary" className="w-full sm:w-auto">
                    Create engagement
                  </Button>
                </Link>
              </div>
              <div className="mt-6 space-y-4">
                {dashboard.data.events.map((event: (typeof dashboard.data.events)[number]) => (
                  <div key={event.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold text-ink">{event.title}</p>
                      <Badge variant={event.status === "completed" ? "neutral" : "accent"}>
                        {formatStatusLabel(event.status)}
                      </Badge>
                      <Badge variant="neutral">{event.serviceTier.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate">
                      {event.location} • {formatDate(event.eventDate)} • {event.requiredRoles.join(", ")}
                    </p>
                    {event.status !== "completed" ? (
                      <Button
                        className="mt-4"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await provider.markEventCompleted(event.id);
                            toast.success("Engagement marked complete.");
                            await refreshSession();
                            await dashboard.refresh();
                          } catch (error) {
                            toast.error(toDisplayError(error));
                          }
                        }}
                      >
                        Mark complete
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
                Deployment requests
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">
                Confirm or release with a clean decision trail
              </h2>
              <div className="mt-6 space-y-4">
                {dashboard.data.recentApplicants.map((application: EnrichedApplication) => (
                  <div key={application.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{application.staff.fullName}</p>
                        <p className="text-sm text-slate">
                          {application.job.title} • {application.event.title}
                        </p>
                      </div>
                      <Badge
                        variant={
                          application.status === "accepted"
                            ? "success"
                            : application.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {formatApplicationStatus(application.status)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate">{application.coverNote}</p>
                    {application.status === "pending" ? (
                      <div className="mt-4 flex gap-3">
                        <Button
                          variant="accent"
                          onClick={async () => {
                            try {
                              const result = await provider.updateApplicationStatus(application.id, "accepted");
                              toast.success(
                                result.warning ? `Deployment confirmed. ${result.warning}` : "Deployment confirmed."
                              );
                              await dashboard.refresh();
                            } catch (error) {
                              toast.error(toDisplayError(error));
                            }
                          }}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await provider.updateApplicationStatus(application.id, "rejected");
                              toast.success("Deployment request released.");
                              await dashboard.refresh();
                            } catch (error) {
                              toast.error(toDisplayError(error));
                            }
                          }}
                        >
                          Release
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
                Job pipeline
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">Close or cancel roles as the brief changes</h2>
              <div className="mt-6 space-y-4">
                {dashboard.data.jobs.length === 0 ? (
                  <EmptyState title="No jobs posted yet" description="Post jobs against an engagement to build the applicant pipeline." />
                ) : (
                  dashboard.data.jobs.map((job: (typeof dashboard.data.jobs)[number]) => (
                    <div key={job.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="font-semibold text-ink">{job.title}</p>
                            <Badge variant={job.status === "open" ? "success" : job.status === "cancelled" ? "danger" : "neutral"}>
                              {formatStatusLabel(job.status)}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate">
                            {job.event.title} • {job.event.location} • {job.applicationCount} requests
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(["open", "closed", "cancelled"] satisfies Extract<JobStatus, "open" | "closed" | "cancelled">[]).map((status) => (
                            <Button
                              key={status}
                              type="button"
                              variant={job.status === status ? "primary" : "secondary"}
                              className="px-4 py-2"
                              disabled={job.status === status}
                              onClick={async () => {
                                try {
                                  await provider.updateJobStatus(job.id, status);
                                  toast.success(`Job marked ${formatStatusLabel(status).toLowerCase()}.`);
                                  await dashboard.refresh();
                                } catch (error) {
                                  toast.error(toDisplayError(error));
                                }
                              }}
                            >
                              {formatStatusLabel(status)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <NotificationsList notifications={dashboard.data.notifications} title="Inbox" />
          </div>

          <div className="space-y-6">
            <Card>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
                Email preferences
              </p>
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={marketingConsent.newsletterConsent}
                    onChange={(event) =>
                      setMarketingConsent((current) => ({ ...current, newsletterConsent: event.target.checked }))
                    }
                  />
                  <div className="space-y-2">
                    <p className="font-medium text-ink">News and newsletters</p>
                    <p className="text-sm text-slate">Athena bulletins, service news, and editorial updates.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={marketingConsent.offersConsent}
                    onChange={(event) =>
                      setMarketingConsent((current) => ({ ...current, offersConsent: event.target.checked }))
                    }
                  />
                  <div className="space-y-2">
                    <p className="font-medium text-ink">Offers and promotions</p>
                    <p className="text-sm text-slate">Commercial offers, launches, and campaign-led promotions.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={marketingConsent.productUpdatesConsent}
                    onChange={(event) =>
                      setMarketingConsent((current) => ({
                        ...current,
                        productUpdatesConsent: event.target.checked
                      }))
                    }
                  />
                  <div className="space-y-2">
                    <p className="font-medium text-ink">Platform updates</p>
                    <p className="text-sm text-slate">Non-essential product changes and feature announcements.</p>
                  </div>
                </div>
              </div>
              <Button
                className="mt-5"
                variant="secondary"
                onClick={async () => {
                  try {
                    const payload = updateMarketingPreferencesSchema.parse(marketingConsent);
                    await provider.updateMarketingPreferences(payload);
                    toast.success("Email preferences updated.");
                    await dashboard.refresh();
                  } catch (error) {
                    toast.error(toDisplayError(error));
                  }
                }}
              >
                Save email preferences
              </Button>
            </Card>

            <Card>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
                Post job
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">
                Add a brief to an engagement
              </h2>
              <form
                className="mt-6 space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  try {
                    const payload = createJobSchema.parse({
                      ...jobForm,
                      payRate: Number(jobForm.payRate),
                      positionsNeeded: Number(jobForm.positionsNeeded),
                      minimumAge: Number(jobForm.minimumAge)
                    });
                    await provider.createJob(payload);
                    toast.success("Job posted.");
                    setJobForm({
                      eventId: "",
                      title: "",
                      description: "",
                      roleType: "",
                      shiftStart: "",
                      shiftEnd: "",
                      payRate: "15",
                      positionsNeeded: "2",
                      minimumAge: "18"
                    });
                    await dashboard.refresh();
                  } catch (error) {
                    toast.error(toDisplayError(error));
                  }
                }}
              >
                <Field label="Engagement">
                  <Select value={jobForm.eventId} onChange={(event) => setJobForm((current) => ({ ...current, eventId: event.target.value }))}>
                    <option value="">Choose an engagement</option>
                    {dashboard.data.events.map((event: (typeof dashboard.data.events)[number]) => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Job title">
                  <Input value={jobForm.title} onChange={(event) => setJobForm((current) => ({ ...current, title: event.target.value }))} />
                </Field>
                <Field label="Discipline">
                  <Input value={jobForm.roleType} onChange={(event) => setJobForm((current) => ({ ...current, roleType: event.target.value }))} />
                </Field>
                <Field label="Scope note">
                  <Textarea value={jobForm.description} onChange={(event) => setJobForm((current) => ({ ...current, description: event.target.value }))} />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Shift start">
                    <Input type="datetime-local" value={jobForm.shiftStart} onChange={(event) => setJobForm((current) => ({ ...current, shiftStart: event.target.value }))} />
                  </Field>
                  <Field label="Shift end">
                    <Input type="datetime-local" value={jobForm.shiftEnd} onChange={(event) => setJobForm((current) => ({ ...current, shiftEnd: event.target.value }))} />
                  </Field>
                  <Field label="Rate">
                    <Input type="number" min={1} value={jobForm.payRate} onChange={(event) => setJobForm((current) => ({ ...current, payRate: event.target.value }))} />
                  </Field>
                  <Field label="Positions needed">
                    <Input type="number" min={1} value={jobForm.positionsNeeded} onChange={(event) => setJobForm((current) => ({ ...current, positionsNeeded: event.target.value }))} />
                  </Field>
                  <Field label="Minimum age">
                    <Input type="number" min={16} value={jobForm.minimumAge} onChange={(event) => setJobForm((current) => ({ ...current, minimumAge: event.target.value }))} />
                  </Field>
                </div>
                <Button type="submit" variant="accent">
                  Post job
                </Button>
              </form>
            </Card>

            <Card>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
                Delivery review queue
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">
                Capture structured performance while the engagement is still fresh
              </h2>
              {dashboard.data.ratingQueue.length === 0 ? (
                <div className="mt-6">
                  <EmptyState
                    title="Nothing waiting for review"
                    description="Confirmed field-team operators from completed engagements appear here until they receive a structured review."
                  />
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <Field label="Select eligible operator">
                    <Select
                      value={selectedReviewContext ? `${selectedReviewContext.event.id}:${selectedReviewContext.staff.id}:${selectedReviewContext.job.id}` : ""}
                      onChange={(event) => {
                        const [eventId, staffId, jobId] = event.target.value.split(":");
                        setReviewForm((current) => ({ ...current, eventId, staffId, jobId }));
                      }}
                    >
                      <option value="">Choose a field-team profile</option>
                      {dashboard.data.ratingQueue.map((item: ReviewQueueItem) => (
                        <option key={`${item.event.id}:${item.staff.id}:${item.job.id}`} value={`${item.event.id}:${item.staff.id}:${item.job.id}`}>
                          {item.staff.fullName} • {item.event.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Reliability">
                    <StarInput value={reviewForm.reliabilityScore} onChange={(value) => setReviewForm((current) => ({ ...current, reliabilityScore: value }))} />
                  </Field>
                  <Field label="Professionalism">
                    <StarInput value={reviewForm.professionalismScore} onChange={(value) => setReviewForm((current) => ({ ...current, professionalismScore: value }))} />
                  </Field>
                  <Field label="Communication">
                    <StarInput value={reviewForm.communicationScore} onChange={(value) => setReviewForm((current) => ({ ...current, communicationScore: value }))} />
                  </Field>
                  <Field label="Customer service / guest interaction">
                    <StarInput value={reviewForm.customerServiceScore} onChange={(value) => setReviewForm((current) => ({ ...current, customerServiceScore: value }))} />
                  </Field>
                  <Field label="Ability to handle pressure">
                    <StarInput value={reviewForm.pressureHandlingScore} onChange={(value) => setReviewForm((current) => ({ ...current, pressureHandlingScore: value }))} />
                  </Field>
                  <Field label="Review note">
                    <Textarea value={reviewForm.comment} onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))} />
                  </Field>
                  <Button
                    variant="accent"
                    onClick={async () => {
                      try {
                        const payload = operatorReviewSchema.parse(reviewForm);
                        await provider.submitOperatorReview(payload);
                        toast.success("Delivery review submitted.");
                        setReviewForm({
                          eventId: "",
                          staffId: "",
                          jobId: "",
                          reliabilityScore: 5,
                          professionalismScore: 5,
                          communicationScore: 5,
                          customerServiceScore: 5,
                          pressureHandlingScore: 5,
                          comment: ""
                        });
                        await dashboard.refresh();
                      } catch (error) {
                        toast.error(toDisplayError(error));
                      }
                    }}
                  >
                    Submit review
                  </Button>
                </div>
              )}
            </Card>

            <Card>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
                Suggested operators
              </p>
              <div className="mt-5 space-y-5">
                {dashboard.data.jobs
                  .filter((job: (typeof dashboard.data.jobs)[number]) => job.status === "open")
                  .slice(0, 3)
                  .map((job: (typeof dashboard.data.jobs)[number]) => (
                    <div key={job.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-ink">{job.title}</p>
                          <p className="text-sm text-slate">
                            {job.event.serviceTier.replace(/_/g, " ")} • {job.event.location}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-ink">{formatCurrency(job.payRate)}/hr</p>
                      </div>
                      <div className="mt-4 space-y-3">
                        {(dashboard.data!.operatorSuggestions[job.id] ?? []).map((suggestion: (typeof dashboard.data.operatorSuggestions)[string][number]) => (
                          <div key={suggestion.operator.staffId} className="rounded-[20px] border border-white/8 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-ink">{suggestion.operator.profile.fullName}</p>
                                <p className="text-sm text-slate">{suggestion.reasons.join(" • ")}</p>
                              </div>
                              <Badge variant="accent">{suggestion.score.toFixed(0)}</Badge>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <PerformanceBar label="Communication" value={suggestion.operator.categoryRatings.communication} />
                              <PerformanceBar label="Customer service" value={suggestion.operator.categoryRatings.customerService} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </div>
      </DashboardShell>
    </main>
  );
}
