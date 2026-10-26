import { describe, expect, it } from "vitest";
import { buildInvoiceRecord, buildLiveAdminDataset, determineAssignmentStatus, type LiveAdminRows } from "@/lib/queries/admin-live";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const day = (offset: number, hour = 9) =>
  new Date(Date.UTC(2026, 10, 15 + offset, hour)).toISOString();

function rows(overrides: Partial<LiveAdminRows> = {}): LiveAdminRows {
  return {
    now: NOW,
    admin: { id: "admin-1", fullName: "Ada Admin", email: "ada@athena.test", adminRole: "super_admin", isActive: true },
    organizationRows: [
      { id: "org-1", name: "Ember Collective", slug: "ember", onboarding_status: "approved", created_at: "2026-09-01T00:00:00Z" },
      { id: "org-2", name: "Harbour Live", slug: "harbour", onboarding_status: "pending", created_at: "2026-10-01T00:00:00Z" }
    ],
    membershipRows: [
      { organization_id: "org-1", profile_id: "owner-1", role: "owner", created_at: "2026-09-01T00:00:00Z" },
      { organization_id: "org-2", profile_id: "owner-2", role: "owner", created_at: "2026-10-01T00:00:00Z" }
    ],
    profileRows: [
      { id: "owner-1", role: "organiser", full_name: "Leah Thompson", email: "leah@ember.test", phone: "0207", created_at: "2026-09-01T00:00:00Z" },
      { id: "owner-2", role: "organiser", full_name: "Harvey Cole", email: "harvey@harbour.test", created_at: "2026-10-01T00:00:00Z" },
      { id: "staff-1", role: "staff", full_name: "Ava Morgan", email: "ava@test", skills: ["bar"], created_at: "2026-09-02T00:00:00Z" },
      { id: "staff-2", role: "staff", full_name: "Theo Carter", email: "theo@test", skills: ["runner"], created_at: "2026-09-03T00:00:00Z" }
    ],
    eventRows: [
      { id: "event-1", organization_id: "org-1", title: "Rooftop Launch", event_type: "Brand launch", location: "London" },
      { id: "event-2", organization_id: "org-1", title: "Past Gala", event_type: "Corporate", location: "London" }
    ],
    jobRows: [
      // Starts in 3 days, needs 2, one accepted -> partially filled, under-filled alert.
      { id: "job-1", event_id: "event-1", organization_id: "org-1", title: "Bartender", role_type: "Bar", status: "open", shift_start: day(3), shift_end: day(3, 15), pay_rate: 15, charge_rate: 25, positions_needed: 2 },
      // Finished last week -> completed.
      { id: "job-2", event_id: "event-2", organization_id: "org-1", title: "Host", role_type: "Host", status: "closed", shift_start: day(-7), shift_end: day(-7, 13), pay_rate: 14, positions_needed: 1 },
      { id: "job-3", event_id: "event-1", organization_id: "org-1", title: "Runner", role_type: "Runner", status: "cancelled", shift_start: day(5), shift_end: day(5, 12), pay_rate: 12, positions_needed: 1 }
    ],
    applicationRows: [
      { id: "app-1", job_id: "job-1", staff_id: "staff-1", status: "accepted" },
      { id: "app-2", job_id: "job-1", staff_id: "staff-2", status: "pending" },
      { id: "app-3", job_id: "job-2", staff_id: "staff-1", status: "accepted" },
      { id: "app-4", job_id: "job-3", staff_id: "staff-2", status: "withdrawn" }
    ],
    ratingRows: [
      { id: "rating-1", event_id: "event-2", job_id: "job-2", organization_id: "org-1", staff_id: "staff-1", organiser_id: "owner-1", overall_score: 4.5, comment: "Great", created_at: day(-6) }
    ],
    operatorProfileRows: [
      { profile_id: "staff-1", display_name: "Ava M.", base_location: "London", onboarding_status: "approved", updated_at: day(-30) },
      { profile_id: "staff-2", display_name: "Theo Carter", base_location: "Leeds", onboarding_status: "pending", updated_at: day(-2) }
    ],
    clientRows: [
      { id: "client-row-1", organization_id: "org-1", company_name: "Ember Collective Ltd", status: "active", billing_contact_email: "accounts@ember.test", notes: "Prefers repeat crew\nPays by BACS", city: "London", postcode: "EC2A 3LT" }
    ],
    operatorRows: [{ id: "op-row-1", user_id: "staff-1", verification_status: "verified", total_no_shows: 1, regions: ["London Central"] }],
    preferenceRows: [{ id: "pref-1", client_id: "client-row-1", operator_id: "op-row-1", preference: "favourite" }],
    documentRows: [{ id: "doc-1", operator_id: "op-row-1", document_type: "Right to work", verification_status: "verified" }],
    invoiceRows: [
      { id: "inv-1", client_id: "client-row-1", invoice_number: "ATH-1001", issue_date: "2026-11-01", due_date: "2026-11-10", total_amount: 1200, amount_paid: 200, status: "sent" },
      { id: "inv-2", client_id: "client-row-1", invoice_number: "ATH-1002", issue_date: "2026-10-01", due_date: "2026-10-31", total_amount: 500, amount_paid: 500, status: "sent" },
      { id: "inv-3", client_id: "client-row-1", invoice_number: "ATH-1003", issue_date: "2026-11-14", due_date: "2026-12-14", total_amount: 999, amount_paid: 0, status: "draft" }
    ],
    paymentRows: [
      { id: "pay-1", client_id: "client-row-1", invoice_id: "inv-2", amount: 500, payment_date: "2026-10-20", payment_method: "bank_transfer" },
      { id: "pay-2", client_id: "client-row-1", invoice_id: "inv-1", amount: 200, payment_date: "2026-11-05", payment_method: "bank_transfer" }
    ],
    payoutRows: [],
    checklistRows: [],
    auditRows: [
      { id: "audit-1", actor_profile_id: "owner-1", entity_type: "client", entity_id: "org-1", action: "Updated client", metadata: { label: "Ember Collective", summary: "Changed status" }, created_at: day(-1) }
    ],
    exportRows: [],
    ...overrides
  };
}

describe("live admin dataset", () => {
  const dataset = buildLiveAdminDataset(rows());

  it("builds clients from organisations, using admin details where they exist", () => {
    const ember = dataset.clientDetails["org-1"];
    expect(ember.companyName).toBe("Ember Collective Ltd");
    expect(ember.primaryContactEmail).toBe("leah@ember.test");
    expect(ember.billingContactEmail).toBe("accounts@ember.test");
    expect(ember.notes).toEqual(["Prefers repeat crew", "Pays by BACS"]);
    expect(ember.address).toBe("London, EC2A 3LT");
    expect(ember.onboardingStatus).toBe("approved");
    expect(ember.preferredOperators.map((operator) => operator.id)).toEqual(["staff-1"]);

    const harbour = dataset.clientDetails["org-2"];
    expect(harbour.companyName).toBe("Harbour Live");
    expect(harbour.billingContactEmail).toBe("harvey@harbour.test");
    expect(harbour.status).toBe("active");
    expect(harbour.onboardingStatus).toBe("pending");
  });

  it("uses real invoices for spend and balances and ignores drafts", () => {
    const ember = dataset.clientDetails["org-1"];
    expect(ember.lifetimeSpend).toBe(1700);
    expect(ember.monthlySpend).toBe(1200);
    expect(ember.outstandingBalance).toBe(1000);
    expect(dataset.finance.totalBilled).toBe(1700);
    expect(dataset.finance.totalCollected).toBe(700);
    expect(dataset.finance.totalOutstanding).toBe(1000);
    expect(dataset.finance.monthlyRevenue).toBe(200);
    expect(dataset.finance.outstandingInvoices.map((invoice) => [invoice.invoiceNumber, invoice.status])).toEqual([
      ["ATH-1001", "overdue"]
    ]);
  });

  it("derives assignment status, headcount and money from jobs", () => {
    const byId = Object.fromEntries(dataset.assignments.map((assignment) => [assignment.id, assignment]));
    expect(byId["job-1"]).toMatchObject({
      status: "partially_filled",
      assignedHeadcount: 1,
      requiredHeadcount: 2,
      applicantCount: 2,
      durationHours: 6,
      labourCost: 180,
      totalChargeAmount: 300,
      athenaServiceCharge: 120,
      totalPayAmount: 90
    });
    expect(byId["job-2"].status).toBe("completed");
    expect(byId["job-2"].totalChargeAmount).toBe(0);
    expect(byId["job-3"].status).toBe("cancelled");
    expect(byId["job-3"].applicantCount).toBe(0);
  });

  it("builds operators from staff profiles with real ratings, documents and onboarding", () => {
    const ava = dataset.operatorDetails["staff-1"];
    expect(ava.displayName).toBe("Ava M.");
    expect(ava.verificationStatus).toBe("verified");
    expect(ava.onboardingStatus).toBe("approved");
    expect(ava.regions).toEqual(["London Central"]);
    expect(ava.averageRating).toBe(4.5);
    expect(ava.totalCompleted).toBe(1);
    expect(ava.totalNoShows).toBe(1);
    expect(ava.favouriteCount).toBe(1);
    expect(ava.earningsYtd).toBe(56);
    expect(ava.documents).toHaveLength(1);

    const theo = dataset.operatorDetails["staff-2"];
    expect(theo.verificationStatus).toBe("pending");
    expect(theo.regions).toEqual(["Leeds"]);
    expect(theo.averageRating).toBe(0);
  });

  it("raises alerts only for real problems", () => {
    const labels = dataset.dashboard.alerts.map((alert) => alert.type);
    expect(labels).toEqual(["balance", "assignment", "onboarding"]);
    expect(dataset.dashboard.kpis.topClient).toBe("Ember Collective Ltd");
    expect(dataset.dashboard.kpis.topOperator).toBe("Ava Morgan");
  });

  it("puts records that need review at the top of the onboarding queue", () => {
    expect(dataset.onboarding.slice(0, 2).map((item) => item.entityId).sort()).toEqual(["org-2", "staff-2"]);
  });

  it("shows audit entries with the actor's name", () => {
    expect(dataset.auditEntries[0]).toMatchObject({ actorName: "Leah Thompson", entityLabel: "Ember Collective" });
    expect(dataset.clientDetails["org-1"].auditEntries).toHaveLength(1);
  });

  it("returns empty, not invented, data for an empty database", () => {
    const empty = buildLiveAdminDataset(
      rows({
        organizationRows: [],
        membershipRows: [],
        profileRows: [],
        eventRows: [],
        jobRows: [],
        applicationRows: [],
        ratingRows: [],
        operatorProfileRows: [],
        clientRows: [],
        operatorRows: [],
        preferenceRows: [],
        documentRows: [],
        invoiceRows: [],
        paymentRows: [],
        auditRows: []
      })
    );
    expect(empty.clients).toEqual([]);
    expect(empty.dashboard.alerts).toEqual([]);
    expect(empty.dashboard.revenueSeries.every((point) => point.value === 0)).toBe(true);
    expect(empty.dashboard.kpis.topClient).toBe("None yet");
  });
});

describe("invoice and assignment status rules", () => {
  it("marks invoices paid, part paid, overdue or sent", () => {
    const base = { id: "i", invoice_number: "A", issue_date: "2026-11-01", status: "sent" };
    expect(buildInvoiceRecord({ ...base, due_date: "2026-12-01", total_amount: 100, amount_paid: 100 }, NOW).status).toBe("paid");
    expect(buildInvoiceRecord({ ...base, due_date: "2026-12-01", total_amount: 100, amount_paid: 40 }, NOW).status).toBe("part_paid");
    expect(buildInvoiceRecord({ ...base, due_date: "2026-11-14", total_amount: 100, amount_paid: 40 }, NOW).status).toBe("overdue");
    expect(buildInvoiceRecord({ ...base, due_date: "2026-11-15", total_amount: 100, amount_paid: 0 }, NOW).status).toBe("sent");
    expect(buildInvoiceRecord({ ...base, status: "draft", due_date: "2026-11-01", total_amount: 100, amount_paid: 0 }, NOW).status).toBe("draft");
  });

  it("keeps draft and cancelled jobs as they are", () => {
    const base = { startsAt: day(1), endsAt: day(1, 12), assignedHeadcount: 0, requiredHeadcount: 1, now: NOW };
    expect(determineAssignmentStatus({ ...base, jobStatus: "draft" })).toBe("draft");
    expect(determineAssignmentStatus({ ...base, jobStatus: "cancelled" })).toBe("cancelled");
    expect(determineAssignmentStatus({ ...base, jobStatus: "open" })).toBe("open");
    expect(determineAssignmentStatus({ ...base, jobStatus: "open", assignedHeadcount: 1 })).toBe("filled");
  });
});
