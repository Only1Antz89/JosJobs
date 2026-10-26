import { z } from "zod";
import { markdownToHtml } from "@/lib/email/content";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import {
  buildInvoiceTotals,
  findBillableJobs,
  invoiceDisplayStatus,
  operatorBalances,
  roundMoney,
  type BillableJob,
  type InvoiceDisplayStatus
} from "@/lib/finance/billing";
import { sendTransactionalTemplateEmail } from "@/lib/services/admin-communications";
import { ensureClientRow, ensureOperatorRow, writeAuditLog } from "@/lib/services/admin-mutations";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/utils";

// Invoices, payments and operator payouts for the admin portal.
// All writes use the service-role client after the route has checked the admin.

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;
type Row = Record<string, unknown>;

function str(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fail(message: string, error?: { message: string } | null, status = 500): never {
  throw new AppError(error ? `${message}: ${error.message}` : message, "FINANCE_FAILED", status);
}

async function selectAll(client: AdminClient, table: string, columns = "*") {
  const { data, error } = await client.from(table).select(columns);
  if (error) fail(`Could not read ${table}`, error);
  return (data ?? []) as unknown as Row[];
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// ---------------------------------------------------------------------------
// Reads

export interface FinanceInvoiceLine {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  jobId: string | null;
}

export interface FinancePayment {
  id: string;
  amount: number;
  paymentDate: string;
  method: string;
  reference: string;
}

export interface FinanceInvoice {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  clientName: string;
  billingName: string;
  billingEmail: string;
  billingAddress: string[];
  clientVatNumber: string;
  issueDate: string;
  dueDate: string;
  sentAt: string | null;
  paidAt: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  status: InvoiceDisplayStatus;
  notes: string;
  accessToken: string;
  lines: FinanceInvoiceLine[];
  payments: FinancePayment[];
}

export interface UnbilledClient {
  organizationId: string;
  clientName: string;
  jobs: BillableJob[];
  total: number;
  missingRates: number;
}

export interface OperatorBalance {
  staffId: string;
  name: string;
  email: string;
  earned: number;
  paidOut: number;
  owed: number;
  shifts: number;
  lastShiftEnd: string;
}

export interface FinancePayout {
  id: string;
  staffId: string;
  operatorName: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  reference: string;
  notes: string;
}

export interface FinanceSettings {
  hasBankDetails: boolean;
  hasStripe: boolean;
  vatRate: number;
  termsDays: number;
}

export interface FinanceWorkspace {
  invoices: FinanceInvoice[];
  unbilled: UnbilledClient[];
  operatorBalances: OperatorBalance[];
  payouts: FinancePayout[];
  settings: FinanceSettings;
  totals: {
    billed: number;
    collected: number;
    outstanding: number;
    overdue: number;
    unbilled: number;
    owedToOperators: number;
    collectedThisMonth: number;
  };
}

export function getFinanceSettings(): FinanceSettings {
  return {
    hasBankDetails: env.hasBankDetails,
    hasStripe: env.hasStripe,
    vatRate: env.vatRate,
    termsDays: env.invoiceTermsDays
  };
}

function addressLines(client: Row) {
  return [client.address_line_1, client.address_line_2, client.city, client.region, client.postcode, client.country]
    .map((part) => str(part).trim())
    .filter(Boolean);
}

export function mapInvoice(input: {
  row: Row;
  clientRow: Row | undefined;
  organizationName: string;
  lines: Row[];
  payments: Row[];
  now?: number;
}): FinanceInvoice {
  const { row, clientRow = {} } = input;
  const totalAmount = roundMoney(num(row.total_amount));
  const amountPaid = roundMoney(num(row.amount_paid));

  return {
    id: str(row.id),
    invoiceNumber: str(row.invoice_number),
    organizationId: str(clientRow.organization_id),
    clientName: str(clientRow.company_name, input.organizationName) || input.organizationName,
    billingName: str(clientRow.billing_contact_name) || str(clientRow.primary_contact_name),
    billingEmail: str(clientRow.billing_contact_email) || str(clientRow.primary_contact_email),
    billingAddress: addressLines(clientRow),
    clientVatNumber: str(clientRow.vat_number),
    issueDate: str(row.issue_date),
    dueDate: str(row.due_date),
    sentAt: row.sent_at ? str(row.sent_at) : null,
    paidAt: row.paid_at ? str(row.paid_at) : null,
    subtotal: roundMoney(num(row.subtotal)),
    taxAmount: roundMoney(num(row.tax_amount)),
    totalAmount,
    amountPaid,
    balance: str(row.status) === "void" ? 0 : roundMoney(Math.max(totalAmount - amountPaid, 0)),
    status: invoiceDisplayStatus(row, input.now),
    notes: str(row.notes),
    accessToken: str(row.access_token),
    lines: input.lines
      .slice()
      .sort((left, right) => num(left.position) - num(right.position))
      .map((line) => ({
        description: str(line.description),
        quantity: num(line.quantity),
        unitAmount: num(line.unit_amount),
        amount: roundMoney(num(line.amount)),
        jobId: line.job_id ? str(line.job_id) : null
      })),
    payments: input.payments
      .map((payment) => ({
        id: str(payment.id),
        amount: roundMoney(num(payment.amount)),
        paymentDate: str(payment.payment_date),
        method: str(payment.payment_method),
        reference: str(payment.external_reference)
      }))
      .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate))
  };
}

function groupBy(rows: Row[], key: string) {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const value = str(row[key]);
    const bucket = map.get(value) ?? [];
    bucket.push(row);
    map.set(value, bucket);
  }
  return map;
}

export async function loadFinanceWorkspace(now = Date.now()): Promise<FinanceWorkspace> {
  const client = createAdminSupabaseClient();
  const [
    invoiceRows,
    lineRows,
    paymentRows,
    clientRows,
    organizationRows,
    jobRows,
    eventRows,
    applicationRows,
    payoutRows,
    operatorRows,
    profileRows
  ] = await Promise.all([
    selectAll(client, "client_invoices"),
    selectAll(client, "invoice_lines"),
    selectAll(client, "client_payments"),
    selectAll(client, "clients"),
    selectAll(client, "organizations", "id, name"),
    selectAll(client, "jobs", "id, event_id, organization_id, title, shift_start, shift_end, pay_rate, charge_rate, status"),
    selectAll(client, "events", "id, title"),
    selectAll(client, "applications", "id, job_id, staff_id, status"),
    selectAll(client, "operator_payouts"),
    selectAll(client, "operators", "id, user_id, display_name"),
    selectAll(client, "profiles", "id, full_name, email, role")
  ]);

  const clientsById = new Map(clientRows.map((row) => [str(row.id), row]));
  const organizationNames = new Map(organizationRows.map((row) => [str(row.id), str(row.name)]));
  const linesByInvoice = groupBy(lineRows, "invoice_id");
  const paymentsByInvoice = groupBy(paymentRows, "invoice_id");

  const invoices = invoiceRows
    .map((row) => {
      const clientRow = clientsById.get(str(row.client_id));
      return mapInvoice({
        row,
        clientRow,
        organizationName: organizationNames.get(str(clientRow?.organization_id)) ?? "Unknown client",
        lines: linesByInvoice.get(str(row.id)) ?? [],
        payments: paymentsByInvoice.get(str(row.id)) ?? [],
        now
      });
    })
    .sort((left, right) => right.invoiceNumber.localeCompare(left.invoiceNumber, undefined, { numeric: true }));

  // Jobs on a draft, sent or paid invoice are billed; a void invoice frees them again.
  const liveInvoiceIds = new Set(invoiceRows.filter((row) => str(row.status) !== "void").map((row) => str(row.id)));
  const invoicedJobIds = new Set(
    lineRows.filter((line) => line.job_id && liveInvoiceIds.has(str(line.invoice_id))).map((line) => str(line.job_id))
  );

  const billable = findBillableJobs({
    jobs: jobRows,
    events: eventRows,
    applications: applicationRows,
    invoicedJobIds,
    now
  });
  const unbilledMap = new Map<string, UnbilledClient>();
  for (const job of billable) {
    const entry = unbilledMap.get(job.organizationId) ?? {
      organizationId: job.organizationId,
      clientName: organizationNames.get(job.organizationId) ?? "Unknown client",
      jobs: [],
      total: 0,
      missingRates: 0
    };
    entry.jobs.push(job);
    entry.total = roundMoney(entry.total + job.amount);
    if (job.chargeRate === null) entry.missingRates += 1;
    unbilledMap.set(job.organizationId, entry);
  }

  const staffIdByOperatorRow = new Map(operatorRows.map((row) => [str(row.id), str(row.user_id)]));
  const profilesById = new Map(profileRows.map((row) => [str(row.id), row]));
  const payoutsByStaffId = new Map<string, number>();
  const payouts: FinancePayout[] = [];

  for (const row of payoutRows) {
    const staffId = staffIdByOperatorRow.get(str(row.operator_id)) ?? "";
    if (str(row.status) !== "void") {
      payoutsByStaffId.set(staffId, roundMoney((payoutsByStaffId.get(staffId) ?? 0) + num(row.gross_amount)));
    }
    payouts.push({
      id: str(row.id),
      staffId,
      operatorName: str(profilesById.get(staffId)?.full_name, "Unknown operator"),
      amount: roundMoney(num(row.gross_amount)),
      periodStart: str(row.period_start),
      periodEnd: str(row.period_end),
      paidAt: row.paid_at ? str(row.paid_at) : null,
      reference: str(row.reference),
      notes: str(row.notes)
    });
  }
  payouts.sort((left, right) => str(right.paidAt).localeCompare(str(left.paidAt)));

  const balances: OperatorBalance[] = operatorBalances({
    jobs: jobRows,
    applications: applicationRows,
    payoutsByStaffId,
    now
  })
    .map((entry) => ({
      ...entry,
      name: str(profilesById.get(entry.staffId)?.full_name, "Unknown operator"),
      email: str(profilesById.get(entry.staffId)?.email)
    }))
    .sort((left, right) => right.owed - left.owed);

  const issued = invoices.filter((invoice) => invoice.status !== "draft" && invoice.status !== "void");
  const monthStart = new Date(now);
  const monthKey = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;

  return {
    invoices,
    unbilled: [...unbilledMap.values()].sort((left, right) => right.total - left.total),
    operatorBalances: balances,
    payouts: payouts.slice(0, 100),
    settings: getFinanceSettings(),
    totals: {
      billed: roundMoney(issued.reduce((sum, invoice) => sum + invoice.totalAmount, 0)),
      collected: roundMoney(issued.reduce((sum, invoice) => sum + invoice.amountPaid, 0)),
      outstanding: roundMoney(issued.reduce((sum, invoice) => sum + invoice.balance, 0)),
      overdue: roundMoney(
        issued.filter((invoice) => invoice.status === "overdue").reduce((sum, invoice) => sum + invoice.balance, 0)
      ),
      unbilled: roundMoney([...unbilledMap.values()].reduce((sum, entry) => sum + entry.total, 0)),
      owedToOperators: roundMoney(balances.reduce((sum, entry) => sum + entry.owed, 0)),
      collectedThisMonth: roundMoney(
        paymentRows
          .filter((payment) => str(payment.payment_date).startsWith(monthKey))
          .reduce((sum, payment) => sum + num(payment.amount), 0)
      )
    }
  };
}

async function loadInvoice(client: AdminClient, filter: { id?: string; accessToken?: string }) {
  let query = client.from("client_invoices").select("*");
  query = filter.id ? query.eq("id", filter.id) : query.eq("access_token", filter.accessToken ?? "");
  const { data: row, error } = await query.maybeSingle();
  if (error) fail("Could not read the invoice", error);
  if (!row) return null;

  const [clientResult, lines, payments] = await Promise.all([
    client.from("clients").select("*").eq("id", str(row.client_id)).maybeSingle(),
    client.from("invoice_lines").select("*").eq("invoice_id", str(row.id)),
    client.from("client_payments").select("*").eq("invoice_id", str(row.id))
  ]);
  if (clientResult.error) fail("Could not read the client", clientResult.error);
  if (lines.error) fail("Could not read invoice lines", lines.error);
  if (payments.error) fail("Could not read payments", payments.error);

  const clientRow = (clientResult.data ?? undefined) as Row | undefined;
  let organizationName = "";
  if (clientRow?.organization_id) {
    const organization = await client
      .from("organizations")
      .select("name")
      .eq("id", str(clientRow.organization_id))
      .maybeSingle();
    organizationName = str(organization.data?.name);
  }

  return mapInvoice({
    row: row as Row,
    clientRow,
    organizationName,
    lines: (lines.data ?? []) as Row[],
    payments: (payments.data ?? []) as Row[]
  });
}

export async function getInvoiceById(invoiceId: string) {
  return loadInvoice(createAdminSupabaseClient(), { id: invoiceId });
}

// For the client's "view and pay" page. Drafts and void invoices are not shown.
export async function getInvoiceByAccessToken(token: string) {
  if (!z.string().uuid().safeParse(token).success) return null;
  const invoice = await loadInvoice(createAdminSupabaseClient(), { accessToken: token });
  return invoice && invoice.status !== "draft" && invoice.status !== "void" ? invoice : null;
}

// ---------------------------------------------------------------------------
// Writes

const extraLineSchema = z.object({
  description: z.string().trim().min(2).max(300),
  quantity: z.number().positive().max(100000),
  unitAmount: z.number().min(-1000000).max(1000000)
});

export const createInvoiceSchema = z
  .object({
    organizationId: z.string().uuid(),
    jobIds: z.array(z.string().uuid()).max(200).default([]),
    extraLines: z.array(extraLineSchema).max(50).default([]),
    notes: z.string().max(2000).optional()
  })
  .refine((value) => value.jobIds.length + value.extraLines.length > 0, {
    message: "Add at least one job or line to the invoice."
  });

export const recordPaymentSchema = z.object({
  amount: z.number().positive().max(10000000),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().trim().max(200).optional()
});

export const recordPayoutSchema = z
  .object({
    staffId: z.string().uuid(),
    amount: z.number().positive().max(1000000),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reference: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional()
  })
  .refine((value) => value.periodStart <= value.periodEnd, { message: "The period must end after it starts." });

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export async function createInvoice(actorId: string, input: CreateInvoiceInput, now = Date.now()) {
  const client = createAdminSupabaseClient();
  const clientRow = await ensureClientRow(client, input.organizationId);

  // Recalculate every job line on the server from the current data.
  const lines: Array<{ jobId: string | null; description: string; quantity: number; unitAmount: number }> = [];

  if (input.jobIds.length > 0) {
    const [jobs, events, applications, liveLines] = await Promise.all([
      client
        .from("jobs")
        .select("id, event_id, organization_id, title, shift_start, shift_end, pay_rate, charge_rate, status")
        .in("id", input.jobIds),
      client.from("events").select("id, title"),
      client.from("applications").select("job_id, status").in("job_id", input.jobIds),
      client.from("invoice_lines").select("job_id, client_invoices!inner(status)").in("job_id", input.jobIds)
    ]);
    for (const result of [jobs, events, applications, liveLines]) {
      if (result.error) fail("Could not read jobs for the invoice", result.error);
    }

    const alreadyInvoiced = new Set(
      ((liveLines.data ?? []) as Row[])
        .filter((line) => {
          const invoice = Array.isArray(line.client_invoices) ? line.client_invoices[0] : line.client_invoices;
          return str((invoice as Row | undefined)?.status) !== "void";
        })
        .map((line) => str(line.job_id))
    );
    const billable = findBillableJobs({
      jobs: ((jobs.data ?? []) as Row[]).filter((job) => str(job.organization_id) === input.organizationId),
      events: (events.data ?? []) as Row[],
      applications: (applications.data ?? []) as Row[],
      invoicedJobIds: alreadyInvoiced,
      now
    });
    const billableIds = new Set(billable.map((job) => job.jobId));
    const notBillable = input.jobIds.filter((jobId) => !billableIds.has(jobId));
    if (notBillable.length > 0) {
      fail("Some jobs can't be invoiced: they're already on an invoice, not finished yet, or belong to another client. Refresh and try again.", null, 409);
    }
    const missingRate = billable.filter((job) => job.chargeRate === null);
    if (missingRate.length > 0) {
      fail(`Set a client charge rate first for: ${missingRate.map((job) => job.title).join(", ")}.`, null, 400);
    }

    for (const job of billable) {
      lines.push({ jobId: job.jobId, description: job.description, quantity: job.workerHours, unitAmount: job.chargeRate ?? 0 });
    }
  }

  for (const line of input.extraLines) {
    lines.push({ jobId: null, description: line.description, quantity: line.quantity, unitAmount: line.unitAmount });
  }

  const totals = buildInvoiceTotals(lines, env.vatRate);
  if (totals.total <= 0) fail("The invoice total must be more than £0.", null, 400);

  const number = await client.rpc("next_client_invoice_number");
  if (number.error || !number.data) fail("Could not get an invoice number", number.error);

  const today = new Date(now);
  const inserted = await client
    .from("client_invoices")
    .insert({
      client_id: clientRow.id,
      invoice_number: number.data as string,
      issue_date: isoDate(today),
      due_date: isoDate(addDays(today, env.invoiceTermsDays)),
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total_amount: totals.total,
      amount_paid: 0,
      status: "draft",
      notes: input.notes?.trim() || null,
      created_by: actorId
    })
    .select("id, invoice_number")
    .single();
  if (inserted.error || !inserted.data) fail("Could not create the invoice", inserted.error);

  const invoiceId = str(inserted.data.id);
  const lineInsert = await client.from("invoice_lines").insert(
    totals.lines.map((line) => ({
      invoice_id: invoiceId,
      job_id: line.jobId,
      description: line.description,
      quantity: line.quantity,
      unit_amount: line.unitAmount,
      amount: line.amount,
      position: line.position
    }))
  );
  if (lineInsert.error) {
    await client.from("client_invoices").delete().eq("id", invoiceId);
    fail("Could not save the invoice lines", lineInsert.error);
  }

  await writeAuditLog(client, {
    actorId,
    entityType: "invoice",
    entityId: invoiceId,
    action: "invoice.created",
    label: "Invoice drafted",
    summary: `${inserted.data.invoice_number} drafted for ${formatMoney(totals.total)}.`
  });

  return { id: invoiceId, invoiceNumber: str(inserted.data.invoice_number) };
}

function bankDetailsMarkdown(invoiceNumber: string) {
  if (!env.hasBankDetails) return "";
  return `

**Pay by bank transfer**

- Account name: ${env.bankAccountName}
- Sort code: ${env.bankSortCode}
- Account number: ${env.bankAccountNumber}
- Reference: ${invoiceNumber}`;
}

export async function sendInvoice(actorId: string, invoiceId: string, origin: string, now = Date.now()) {
  const client = createAdminSupabaseClient();
  const invoice = await loadInvoice(client, { id: invoiceId });
  if (!invoice) fail("Invoice not found.", null, 404);
  if (invoice.status === "void") fail("This invoice has been voided.", null, 409);
  if (invoice.status === "paid") fail("This invoice is already paid.", null, 409);
  if (!invoice.billingEmail) fail("Add a billing or primary contact email for this client first.", null, 400);
  if (!env.hasBankDetails && !env.hasStripe) {
    fail("Add your bank details (or Stripe keys) to the site settings before sending invoices, so clients know how to pay.", null, 400);
  }

  const firstSend = invoice.status === "draft";
  if (firstSend) {
    // The invoice is issued today; payment terms run from the send date.
    const today = new Date(now);
    const { error } = await client
      .from("client_invoices")
      .update({
        status: "sent",
        issue_date: isoDate(today),
        due_date: isoDate(addDays(today, env.invoiceTermsDays)),
        sent_at: today.toISOString()
      })
      .eq("id", invoiceId)
      .eq("status", "draft");
    if (error) fail("Could not mark the invoice as sent", error);
  }

  const fresh = (await loadInvoice(client, { id: invoiceId }))!;
  const link = `${origin}/invoices/${fresh.accessToken}`;
  const cardLine = env.hasStripe ? "\n\nYou can also pay securely by card from the invoice page." : "";
  const bodyMarkdown = `# Invoice ${fresh.invoiceNumber}
${firstSend ? "Thank you for booking with Athena Pro. Your invoice is ready." : "This is a reminder that the invoice below is still open."}

- Amount due: ${formatMoney(fresh.balance)}
- Due date: ${new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(fresh.dueDate))}${bankDetailsMarkdown(fresh.invoiceNumber)}${cardLine}`;

  try {
    await sendTransactionalTemplateEmail({
      templateType: "payment",
      to: fresh.billingEmail,
      recipientName: fresh.billingName || undefined,
      subject: firstSend
        ? `Invoice ${fresh.invoiceNumber} from Athena Pro`
        : `Reminder: invoice ${fresh.invoiceNumber} is due`,
      bodyMarkdown,
      bodyHtml: markdownToHtml(bodyMarkdown),
      ctaLabel: env.hasStripe ? "View and pay invoice" : "View invoice",
      ctaUrl: link,
      metadata: { invoiceId, kind: firstSend ? "invoice" : "invoice_reminder" }
    });
  } catch (error) {
    console.error("[athena] invoice email failed", error);
    await writeAuditLog(client, {
      actorId,
      entityType: "invoice",
      entityId: invoiceId,
      action: firstSend ? "invoice.issued" : "invoice.reminder_failed",
      label: firstSend ? "Invoice issued (email failed)" : "Reminder failed",
      summary: `Email to ${fresh.billingEmail} failed.`
    });
    return {
      warning: `${firstSend ? "The invoice is marked as sent, but the" : "The"} email to ${fresh.billingEmail} didn't go out. You can copy the invoice link from the invoice page and send it yourself.`
    };
  }

  await writeAuditLog(client, {
    actorId,
    entityType: "invoice",
    entityId: invoiceId,
    action: firstSend ? "invoice.sent" : "invoice.reminder_sent",
    label: firstSend ? "Invoice sent" : "Payment reminder sent",
    summary: `${fresh.invoiceNumber} emailed to ${fresh.billingEmail}.`
  });

  return { warning: undefined };
}

export async function recordInvoicePayment(input: {
  actorId: string | null;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  method: "bank_transfer" | "card" | "other";
  reference?: string;
}) {
  const client = createAdminSupabaseClient();
  const { data, error } = await client.rpc("record_client_payment", {
    p_invoice_id: input.invoiceId,
    p_amount: roundMoney(input.amount),
    p_payment_date: input.paymentDate,
    p_payment_method: input.method,
    p_external_reference: input.reference?.trim() ?? "",
    p_recorded_by: input.actorId
  });

  if (error) {
    if (error.code === "P0002") fail("Invoice not found.", null, 404);
    if (error.code === "P0001") fail(error.message, null, 409);
    fail("Could not record the payment", error);
  }

  const recorded = Boolean(data);
  if (recorded) {
    await writeAuditLog(client, {
      actorId: input.actorId,
      entityType: "invoice",
      entityId: input.invoiceId,
      action: "invoice.payment_recorded",
      label: input.method === "card" ? "Card payment received" : "Payment recorded",
      summary: `${formatMoney(input.amount)} by ${input.method.replace("_", " ")}${input.reference ? ` (ref ${input.reference})` : ""}.`
    });
  }

  return { recorded };
}

export async function voidInvoice(actorId: string, invoiceId: string) {
  const client = createAdminSupabaseClient();
  const { data: row, error } = await client
    .from("client_invoices")
    .select("id, invoice_number, status, amount_paid")
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) fail("Could not read the invoice", error);
  if (!row) fail("Invoice not found.", null, 404);
  if (str(row.status) === "void") return { warning: undefined };
  if (num(row.amount_paid) > 0) {
    fail("This invoice has payments recorded, so it can't be voided. Issue a credit or refund instead.", null, 409);
  }

  const update = await client
    .from("client_invoices")
    .update({ status: "void", voided_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("amount_paid", 0);
  if (update.error) fail("Could not void the invoice", update.error);

  await writeAuditLog(client, {
    actorId,
    entityType: "invoice",
    entityId: invoiceId,
    action: "invoice.voided",
    label: "Invoice voided",
    summary: `${row.invoice_number} voided. Its jobs can be invoiced again.`
  });

  return { warning: undefined };
}

export async function recordPayout(actorId: string, input: z.infer<typeof recordPayoutSchema>) {
  const client = createAdminSupabaseClient();
  const operator = await ensureOperatorRow(client, input.staffId);
  const now = new Date().toISOString();

  const inserted = await client
    .from("operator_payouts")
    .insert({
      operator_id: operator.id,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      gross_amount: roundMoney(input.amount),
      status: "paid",
      paid_at: now,
      reference: input.reference || null,
      notes: input.notes || null,
      created_by: actorId
    })
    .select("id")
    .single();
  if (inserted.error || !inserted.data) fail("Could not record the payout", inserted.error);

  await writeAuditLog(client, {
    actorId,
    entityType: "operator",
    entityId: input.staffId,
    action: "operator.payout_recorded",
    label: "Payout recorded",
    summary: `${formatMoney(input.amount)} paid for ${input.periodStart} to ${input.periodEnd}${input.reference ? ` (ref ${input.reference})` : ""}.`
  });

  return { id: str(inserted.data.id) };
}
