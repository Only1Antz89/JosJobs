import { getRuntimeMode } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { toCsv, type CsvValue } from "@/lib/finance/csv";
import { getAdminDataset } from "@/lib/queries/admin-dataset";
import { loadFinanceWorkspace } from "@/lib/services/admin-finance";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AdminIdentity, AdminRole } from "@/types/admin";

// One-click CSV downloads for the reports page. Each export is built on request
// from live data and logged in export_jobs so the reports page shows who
// downloaded what.

export const EXPORT_TYPES = {
  clients: { label: "Clients", finance: false },
  operators: { label: "Operators", finance: false },
  assignments: { label: "Assignments (jobs)", finance: false },
  invoices: { label: "Invoices", finance: true },
  invoice_lines: { label: "Invoice lines", finance: true },
  payments: { label: "Payments received", finance: true },
  payouts: { label: "Operator payouts", finance: true },
  operator_balances: { label: "Operator pay owed", finance: true }
} as const;

export type ExportType = keyof typeof EXPORT_TYPES;

export function isExportType(value: string): value is ExportType {
  return Object.prototype.hasOwnProperty.call(EXPORT_TYPES, value);
}

const FINANCE_ROLES: AdminRole[] = ["super_admin", "finance_admin"];

function date(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

async function rowsFor(type: ExportType): Promise<{ headers: string[]; rows: CsvValue[][] }> {
  if (type === "clients" || type === "operators" || type === "assignments") {
    const data = await getAdminDataset();

    if (type === "clients") {
      return {
        headers: ["Client ID", "Company", "Primary contact", "Primary email", "Billing email", "Status", "Onboarding", "Signed up", "Active jobs", "Lifetime spend", "Outstanding"],
        rows: data.clients.map((client) => [
          client.id, client.companyName, client.primaryContactName, client.primaryContactEmail, client.billingContactEmail,
          client.status, client.onboardingStatus, date(client.signupDate), client.activeAssignments, client.lifetimeSpend, client.outstandingBalance
        ])
      };
    }

    if (type === "operators") {
      return {
        headers: ["Operator ID", "Name", "Email", "Active", "Verification", "Onboarding", "Regions", "Skills", "Average rating", "Completed shifts", "Cancellations", "No-shows", "Earnings this year"],
        rows: data.operators.map((operator) => [
          operator.id, operator.displayName, operator.email, operator.isActive ? "yes" : "no", operator.verificationStatus,
          operator.onboardingStatus, operator.regions.join("; "), operator.skillTags.join("; "), operator.averageRating,
          operator.totalCompleted, operator.totalCancellations, operator.totalNoShows, operator.earningsYtd
        ])
      };
    }

    return {
      headers: ["Job ID", "Client", "Event", "Job", "Role", "Location", "Starts", "Ends", "Hours", "Status", "Needed", "Assigned", "Pay rate", "Charge rate", "Charge total", "Pay total"],
      rows: data.assignments.map((assignment) => [
        assignment.id, assignment.clientName, assignment.eventTitle, assignment.title, assignment.roleType, assignment.locationName,
        assignment.startsAt, assignment.endsAt, assignment.durationHours, assignment.status, assignment.requiredHeadcount,
        assignment.assignedHeadcount, assignment.payRate, assignment.chargeRate, assignment.totalChargeAmount, assignment.totalPayAmount
      ])
    };
  }

  if (getRuntimeMode() !== "live") {
    throw new AppError("Finance exports need the live database.", "DEMO_MODE", 409);
  }

  const finance = await loadFinanceWorkspace();

  switch (type) {
    case "invoices":
      return {
        headers: ["Invoice", "Client", "Billing email", "Status", "Issued", "Due", "Sent", "Paid on", "Subtotal", "VAT", "Total", "Paid", "Balance"],
        rows: finance.invoices.map((invoice) => [
          invoice.invoiceNumber, invoice.clientName, invoice.billingEmail, invoice.status, date(invoice.issueDate), date(invoice.dueDate),
          date(invoice.sentAt), date(invoice.paidAt), invoice.subtotal, invoice.taxAmount, invoice.totalAmount, invoice.amountPaid, invoice.balance
        ])
      };
    case "invoice_lines":
      return {
        headers: ["Invoice", "Client", "Status", "Description", "Quantity", "Rate", "Amount", "Job ID"],
        rows: finance.invoices.flatMap((invoice) =>
          invoice.lines.map((line) => [
            invoice.invoiceNumber, invoice.clientName, invoice.status, line.description, line.quantity, line.unitAmount, line.amount, line.jobId ?? ""
          ])
        )
      };
    case "payments":
      return {
        headers: ["Date", "Invoice", "Client", "Method", "Reference", "Amount"],
        rows: finance.invoices
          .flatMap((invoice) =>
            invoice.payments.map((payment) => [
              date(payment.paymentDate), invoice.invoiceNumber, invoice.clientName, payment.method, payment.reference, payment.amount
            ])
          )
          .sort((left, right) => String(right[0]).localeCompare(String(left[0])))
      };
    case "payouts":
      return {
        headers: ["Paid on", "Operator", "Work from", "Work to", "Amount", "Reference", "Notes"],
        rows: finance.payouts.map((payout) => [
          date(payout.paidAt), payout.operatorName, payout.periodStart, payout.periodEnd, payout.amount, payout.reference, payout.notes
        ])
      };
    case "operator_balances":
      return {
        headers: ["Operator", "Email", "Finished shifts", "Earned", "Paid out", "Owed", "Last shift"],
        rows: finance.operatorBalances.map((entry) => [
          entry.name, entry.email, entry.shifts, entry.earned, entry.paidOut, entry.owed, date(entry.lastShiftEnd)
        ])
      };
  }
}

export async function buildExport(admin: AdminIdentity, type: ExportType) {
  if (EXPORT_TYPES[type].finance && !FINANCE_ROLES.includes(admin.adminRole)) {
    throw new AppError("Only finance admins can download finance exports.", "FORBIDDEN", 403);
  }

  const { headers, rows } = await rowsFor(type);
  const stamp = new Date().toISOString().slice(0, 10);

  if (getRuntimeMode() === "live") {
    const now = new Date().toISOString();
    const { error } = await createAdminSupabaseClient()
      .from("export_jobs")
      .insert({
        export_type: type,
        format: "csv",
        filters: { rows: rows.length },
        requested_by: admin.id,
        status: "completed",
        created_at: now,
        completed_at: now
      });
    if (error) console.error("[athena] export log failed", error);
  }

  return { filename: `athena-${type.replace(/_/g, "-")}-${stamp}.csv`, csv: toCsv(headers, rows) };
}
