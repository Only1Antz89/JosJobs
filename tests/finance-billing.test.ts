import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildInvoiceTotals,
  findBillableJobs,
  invoiceDisplayStatus,
  operatorBalances,
  shiftHours
} from "@/lib/finance/billing";
import { csvCell, toCsv } from "@/lib/finance/csv";
import { verifyStripeSignature } from "@/lib/payments/stripe";

const NOW = Date.parse("2026-11-10T12:00:00Z");

const jobs = [
  // Finished, 2 accepted, rate set.
  { id: "j1", event_id: "e1", organization_id: "o1", title: "Steward", shift_start: "2026-11-01T10:00:00Z", shift_end: "2026-11-01T16:30:00Z", pay_rate: 13, charge_rate: 20, status: "closed" },
  // Finished, no rate yet.
  { id: "j2", event_id: "e1", organization_id: "o1", title: "Scanner", shift_start: "2026-11-02T10:00:00Z", shift_end: "2026-11-02T14:00:00Z", pay_rate: 12, charge_rate: null, status: "open" },
  // Not finished.
  { id: "j3", event_id: "e1", organization_id: "o1", title: "Future", shift_start: "2026-12-01T10:00:00Z", shift_end: "2026-12-01T14:00:00Z", pay_rate: 12, charge_rate: 20, status: "open" },
  // Cancelled.
  { id: "j4", event_id: "e1", organization_id: "o1", title: "Cancelled", shift_start: "2026-11-01T10:00:00Z", shift_end: "2026-11-01T14:00:00Z", pay_rate: 12, charge_rate: 20, status: "cancelled" },
  // Finished but nobody accepted.
  { id: "j5", event_id: "e1", organization_id: "o1", title: "Empty", shift_start: "2026-11-01T10:00:00Z", shift_end: "2026-11-01T14:00:00Z", pay_rate: 12, charge_rate: 20, status: "closed" },
  // Already invoiced.
  { id: "j6", event_id: "e1", organization_id: "o1", title: "Billed", shift_start: "2026-11-01T10:00:00Z", shift_end: "2026-11-01T14:00:00Z", pay_rate: 12, charge_rate: 20, status: "closed" }
];
const applications = [
  { job_id: "j1", staff_id: "s1", status: "accepted" },
  { job_id: "j1", staff_id: "s2", status: "accepted" },
  { job_id: "j1", staff_id: "s3", status: "rejected" },
  { job_id: "j2", staff_id: "s1", status: "accepted" },
  { job_id: "j3", staff_id: "s1", status: "accepted" },
  { job_id: "j4", staff_id: "s1", status: "accepted" },
  { job_id: "j6", staff_id: "s2", status: "accepted" }
];

describe("billing", () => {
  it("only bills finished, staffed, uninvoiced jobs", () => {
    const billable = findBillableJobs({
      jobs,
      events: [{ id: "e1", title: "Autumn Fair" }],
      applications,
      invoicedJobIds: new Set(["j6"]),
      now: NOW
    });

    expect(billable.map((job) => job.jobId)).toEqual(["j1", "j2"]);
    expect(billable[0]).toMatchObject({ headcount: 2, hours: 6.5, workerHours: 13, chargeRate: 20, amount: 260 });
    expect(billable[0].description).toContain("Autumn Fair");
    expect(billable[1]).toMatchObject({ chargeRate: null, amount: 0 });
  });

  it("works out hours from shift times", () => {
    expect(shiftHours("2026-11-01T22:00:00Z", "2026-11-02T03:15:00Z")).toBe(5.25);
    expect(shiftHours("bad", "2026-11-02T03:15:00Z")).toBe(0);
  });

  it("adds VAT and rounds to the penny", () => {
    const totals = buildInvoiceTotals(
      [
        { jobId: "j1", description: "Steward", quantity: 13, unitAmount: 20 },
        { jobId: null, description: "Radio hire", quantity: 3, unitAmount: 3.333 }
      ],
      20
    );
    expect(totals.lines.map((line) => line.amount)).toEqual([260, 10]);
    expect(totals).toMatchObject({ subtotal: 270, taxAmount: 54, total: 324 });
  });

  it("shows the right invoice status", () => {
    const base = { total_amount: 100, amount_paid: 0, due_date: "2026-11-20", status: "sent" };
    expect(invoiceDisplayStatus({ ...base, status: "draft" }, NOW)).toBe("draft");
    expect(invoiceDisplayStatus({ ...base, status: "void" }, NOW)).toBe("void");
    expect(invoiceDisplayStatus(base, NOW)).toBe("sent");
    expect(invoiceDisplayStatus({ ...base, amount_paid: 40 }, NOW)).toBe("part_paid");
    expect(invoiceDisplayStatus({ ...base, amount_paid: 100 }, NOW)).toBe("paid");
    expect(invoiceDisplayStatus({ ...base, due_date: "2026-11-01" }, NOW)).toBe("overdue");
  });

  it("works out operator pay owed after payouts", () => {
    const balances = operatorBalances({ jobs, applications, payoutsByStaffId: new Map([["s1", 50]]), now: NOW });
    const s1 = balances.find((entry) => entry.staffId === "s1");
    const s2 = balances.find((entry) => entry.staffId === "s2");
    // s1: j1 6.5h × £13 + j2 4h × £12 = 84.5 + 48 = 132.5; future and cancelled jobs don't count.
    expect(s1).toMatchObject({ earned: 132.5, paidOut: 50, owed: 82.5, shifts: 2 });
    // s2: j1 84.5 + j6 48.
    expect(s2).toMatchObject({ earned: 132.5, owed: 132.5 });
  });
});

describe("csv", () => {
  it("quotes and defuses spreadsheet formulas", () => {
    expect(csvCell('Smith, "Jo"')).toBe('"Smith, ""Jo"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(toCsv(["a", "b"], [[1, null]])).toBe("a,b\r\n1,\r\n");
  });
});

describe("stripe signature", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ type: "checkout.session.completed" });
  const sign = (timestamp: number, payload = body) =>
    `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;

  it("accepts a valid, fresh signature", () => {
    expect(verifyStripeSignature(body, sign(1_000_000), secret, 1_000_010)).toBe(true);
  });

  it("rejects tampered, stale or missing signatures", () => {
    expect(verifyStripeSignature(`${body} `, sign(1_000_000), secret, 1_000_010)).toBe(false);
    expect(verifyStripeSignature(body, sign(1_000_000), secret, 1_000_000 + 301)).toBe(false);
    expect(verifyStripeSignature(body, null, secret)).toBe(false);
    expect(verifyStripeSignature(body, "t=1,v1=zz", secret, 1)).toBe(false);
  });
});
