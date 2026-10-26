// Pure billing rules shared by the admin finance pages, invoice creation and tests.
// Nothing here touches the database.

type Row = Record<string, unknown>;

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function str(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function shiftHours(start: string, end: string) {
  const milliseconds = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(milliseconds) ? Math.max(roundMoney(milliseconds / 3_600_000), 0) : 0;
}

export interface BillableJob {
  jobId: string;
  organizationId: string;
  title: string;
  eventTitle: string;
  shiftStart: string;
  shiftEnd: string;
  headcount: number;
  hours: number;
  workerHours: number;
  chargeRate: number | null;
  payRate: number;
  amount: number;
  description: string;
}

function describeJob(job: { title: string; eventTitle: string; shiftStart: string; headcount: number; hours: number }) {
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(
    new Date(job.shiftStart)
  );
  const event = job.eventTitle ? ` (${job.eventTitle})` : "";
  const people = `${job.headcount} ${job.headcount === 1 ? "person" : "people"}`;
  return `${job.title}${event}, ${date}: ${people} × ${job.hours} hrs`;
}

// Jobs that have finished, had at least one accepted worker, and are not on a live
// (non-void) invoice yet. Jobs without a charge rate are returned with
// chargeRate null so the admin can see they need a rate before billing.
export function findBillableJobs(input: {
  jobs: Row[];
  events: Row[];
  applications: Row[];
  invoicedJobIds: Set<string>;
  now?: number;
}): BillableJob[] {
  const now = input.now ?? Date.now();
  const eventTitles = new Map(input.events.map((event) => [str(event.id), str(event.title)]));
  const acceptedByJob = new Map<string, number>();

  for (const application of input.applications) {
    if (application.status !== "accepted") continue;
    const jobId = str(application.job_id);
    acceptedByJob.set(jobId, (acceptedByJob.get(jobId) ?? 0) + 1);
  }

  return input.jobs
    .filter((job) => {
      const status = str(job.status);
      return (
        status !== "cancelled" &&
        status !== "draft" &&
        new Date(str(job.shift_end)).getTime() < now &&
        (acceptedByJob.get(str(job.id)) ?? 0) > 0 &&
        !input.invoicedJobIds.has(str(job.id))
      );
    })
    .map((job) => {
      const headcount = acceptedByJob.get(str(job.id)) ?? 0;
      const hours = shiftHours(str(job.shift_start), str(job.shift_end));
      const workerHours = roundMoney(headcount * hours);
      const chargeRate = job.charge_rate === null || job.charge_rate === undefined ? null : num(job.charge_rate);
      const base = {
        jobId: str(job.id),
        organizationId: str(job.organization_id),
        title: str(job.title),
        eventTitle: eventTitles.get(str(job.event_id)) ?? "",
        shiftStart: str(job.shift_start),
        shiftEnd: str(job.shift_end),
        headcount,
        hours
      };

      return {
        ...base,
        workerHours,
        chargeRate,
        payRate: num(job.pay_rate),
        amount: chargeRate === null ? 0 : roundMoney(workerHours * chargeRate),
        description: describeJob(base)
      };
    })
    .sort((left, right) => left.shiftStart.localeCompare(right.shiftStart));
}

export interface InvoiceLineInput {
  jobId: string | null;
  description: string;
  quantity: number;
  unitAmount: number;
}

export function buildInvoiceTotals(lines: InvoiceLineInput[], vatRatePercent: number) {
  const pricedLines = lines.map((line, position) => ({
    ...line,
    position,
    amount: roundMoney(line.quantity * line.unitAmount)
  }));
  const subtotal = roundMoney(pricedLines.reduce((sum, line) => sum + line.amount, 0));
  const taxAmount = roundMoney((subtotal * vatRatePercent) / 100);

  return { lines: pricedLines, subtotal, taxAmount, total: roundMoney(subtotal + taxAmount) };
}

export type InvoiceDisplayStatus = "draft" | "sent" | "part_paid" | "paid" | "overdue" | "void";

export function invoiceDisplayStatus(row: Row, now = Date.now()): InvoiceDisplayStatus {
  const stored = str(row.status, "draft");
  if (stored === "draft" || stored === "void") return stored;

  const total = roundMoney(num(row.total_amount));
  const paid = roundMoney(num(row.amount_paid));
  if (total > 0 && paid >= total) return "paid";

  const due = str(row.due_date);
  if (due && new Date(`${due.slice(0, 10)}T23:59:59Z`).getTime() < now) return "overdue";
  return paid > 0 ? "part_paid" : "sent";
}

// What each operator has earned on finished jobs, minus payouts already recorded.
export function operatorBalances(input: {
  jobs: Row[];
  applications: Row[];
  payoutsByStaffId: Map<string, number>;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const jobsById = new Map(input.jobs.map((job) => [str(job.id), job]));
  const earned = new Map<string, { amount: number; shifts: number; lastShiftEnd: string }>();

  for (const application of input.applications) {
    if (application.status !== "accepted") continue;
    const job = jobsById.get(str(application.job_id));
    if (!job || str(job.status) === "cancelled") continue;
    const shiftEnd = str(job.shift_end);
    if (new Date(shiftEnd).getTime() >= now) continue;

    const staffId = str(application.staff_id);
    const entry = earned.get(staffId) ?? { amount: 0, shifts: 0, lastShiftEnd: "" };
    entry.amount = roundMoney(entry.amount + num(job.pay_rate) * shiftHours(str(job.shift_start), shiftEnd));
    entry.shifts += 1;
    if (shiftEnd > entry.lastShiftEnd) entry.lastShiftEnd = shiftEnd;
    earned.set(staffId, entry);
  }

  return [...earned.entries()].map(([staffId, entry]) => {
    const paidOut = roundMoney(input.payoutsByStaffId.get(staffId) ?? 0);
    return {
      staffId,
      earned: entry.amount,
      shifts: entry.shifts,
      lastShiftEnd: entry.lastShiftEnd,
      paidOut,
      owed: roundMoney(Math.max(entry.amount - paidOut, 0))
    };
  });
}
