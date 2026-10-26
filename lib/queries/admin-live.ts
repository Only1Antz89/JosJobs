import { buildRankedStaff } from "@/lib/domain/ranking";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email/catalog";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type {
  AdminAlert,
  AdminChartPoint,
  AdminDataset,
  AdminIdentity,
  AssignmentApplicant,
  AssignmentDetail,
  AssignmentStatus,
  AssignmentSummary,
  AuditEntry,
  ClientDetail,
  ClientFinancialRecord,
  ClientPaymentRecord,
  ClientStatus,
  ClientSummary,
  ExportJob,
  FinanceSummary,
  OnboardingItem,
  OnboardingStatus,
  OperatorDetail,
  OperatorDocument,
  OperatorSummary,
  VerificationStatus
} from "@/types/admin";
import type { Profile, Rating } from "@/types/domain";

// Builds the admin portal's data from the real Supabase tables.
//
// Source of truth:
// - clients = organizations (+ optional admin details in public.clients)
// - operators = staff profiles (+ optional admin details in public.operators)
// - assignments = jobs, with applications as applicants and placements
// - money = client_invoices, client_payments and operator_payouts
//
// Nothing here is invented: a value the database does not hold is shown as zero
// or left empty, never estimated.

type Row = Record<string, unknown>;

const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = ["open", "partially_filled", "filled", "in_progress"];
const ONBOARDING_STATUSES: OnboardingStatus[] = ["pending", "in_review", "approved", "rejected"];
const VERIFICATION_STATUSES: VerificationStatus[] = ["pending", "in_review", "verified", "rejected"];
const CLIENT_STATUSES: ClientStatus[] = ["active", "inactive", "at_risk"];

function str(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function hoursBetween(start: string, end: string) {
  const milliseconds = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(milliseconds / (1000 * 60 * 60), 0);
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function splitNotes(value: unknown) {
  return str(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }).map((_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1));
    return {
      key: monthKey(date),
      label: date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })
    };
  });
}

export function mapProfileRow(row: Row): Profile {
  return {
    id: str(row.id),
    role: row.role as Profile["role"],
    fullName: str(row.full_name),
    email: str(row.email),
    phone: row.phone ? str(row.phone) : undefined,
    companyName: row.company_name ? str(row.company_name) : undefined,
    bio: row.bio ? str(row.bio) : undefined,
    skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
    availability: row.availability ? str(row.availability) : undefined,
    avatarUrl: row.avatar_url ? str(row.avatar_url) : undefined,
    location: row.location ? str(row.location) : undefined,
    languages: Array.isArray(row.languages) ? row.languages.map(String) : undefined,
    preferredRoles: Array.isArray(row.preferred_roles) ? row.preferred_roles.map(String) : undefined,
    age: row.age ? num(row.age) : undefined,
    createdAt: str(row.created_at),
    updatedAt: row.updated_at ? str(row.updated_at) : undefined
  };
}

export function mapRatingRow(row: Row): Rating {
  const overallScore = num(row.overall_score ?? row.rating);

  return {
    id: str(row.id),
    eventId: str(row.event_id),
    jobId: str(row.job_id),
    organizationId: str(row.organization_id),
    staffId: str(row.staff_id),
    organiserId: str(row.organiser_id),
    reliabilityScore: num(row.reliability_score ?? overallScore),
    professionalismScore: num(row.professionalism_score ?? overallScore),
    communicationScore: num(row.communication_score ?? overallScore),
    customerServiceScore: num(row.customer_service_score ?? overallScore),
    pressureHandlingScore: num(row.pressure_handling_score ?? overallScore),
    overallScore,
    rating: overallScore,
    comment: str(row.comment),
    createdAt: str(row.created_at)
  };
}

export function determineAssignmentStatus(input: {
  jobStatus: string;
  startsAt: string;
  endsAt: string;
  assignedHeadcount: number;
  requiredHeadcount: number;
  now?: number;
}): AssignmentStatus {
  const now = input.now ?? Date.now();

  if (input.jobStatus === "cancelled") {
    return "cancelled";
  }

  if (input.jobStatus === "draft") {
    return "draft";
  }

  if (new Date(input.endsAt).getTime() < now) {
    return "completed";
  }

  if (new Date(input.startsAt).getTime() <= now) {
    return "in_progress";
  }

  if (input.assignedHeadcount >= input.requiredHeadcount) {
    return "filled";
  }

  if (input.assignedHeadcount > 0) {
    return "partially_filled";
  }

  return "open";
}

export function buildInvoiceRecord(row: Row, now = Date.now()): ClientFinancialRecord {
  const totalAmount = toCurrency(num(row.total_amount));
  const amountPaid = toCurrency(num(row.amount_paid));
  const balance = toCurrency(Math.max(totalAmount - amountPaid, 0));
  const storedStatus = str(row.status, "draft");
  const dueDate = str(row.due_date);
  let status: ClientFinancialRecord["status"];

  if (storedStatus === "draft") {
    status = "draft";
  } else if (balance <= 0 && totalAmount > 0) {
    status = "paid";
  } else if (dueDate && new Date(`${dueDate.slice(0, 10)}T23:59:59Z`).getTime() < now) {
    status = "overdue";
  } else if (amountPaid > 0) {
    status = "part_paid";
  } else {
    status = "sent";
  }

  return {
    invoiceId: str(row.id),
    invoiceNumber: str(row.invoice_number),
    issueDate: str(row.issue_date),
    dueDate,
    totalAmount,
    amountPaid,
    balance,
    status
  };
}

async function selectAll(client: ReturnType<typeof createAdminSupabaseClient>, table: string, columns = "*") {
  const { data, error } = await client.from(table).select(columns);

  if (error) {
    throw new Error(`Admin data: could not read ${table}: ${error.message}`);
  }

  return (data ?? []) as unknown as Row[];
}

export async function loadLiveAdminDataset(admin: AdminIdentity): Promise<AdminDataset> {
  const client = createAdminSupabaseClient();
  const [
    organizationRows,
    membershipRows,
    profileRows,
    eventRows,
    jobRows,
    applicationRows,
    ratingRows,
    operatorProfileRows,
    clientRows,
    operatorRows,
    preferenceRows,
    documentRows,
    invoiceRows,
    paymentRows,
    payoutRows,
    checklistRows,
    auditRows,
    exportRows
  ] = await Promise.all([
    selectAll(client, "organizations"),
    selectAll(client, "organization_memberships"),
    selectAll(client, "profiles"),
    selectAll(client, "events"),
    selectAll(client, "jobs"),
    selectAll(client, "applications"),
    selectAll(client, "ratings"),
    selectAll(client, "operator_profiles"),
    selectAll(client, "clients"),
    selectAll(client, "operators"),
    selectAll(client, "client_operator_preferences"),
    selectAll(client, "operator_documents"),
    selectAll(client, "client_invoices"),
    selectAll(client, "client_payments"),
    selectAll(client, "operator_payouts"),
    selectAll(client, "onboarding_checklists"),
    client
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) throw new Error(`Admin data: could not read audit_logs: ${error.message}`);
        return (data ?? []) as Row[];
      }),
    client
      .from("export_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) throw new Error(`Admin data: could not read export_jobs: ${error.message}`);
        return (data ?? []) as Row[];
      })
  ]);

  return buildLiveAdminDataset({
    admin,
    organizationRows,
    membershipRows,
    profileRows,
    eventRows,
    jobRows,
    applicationRows,
    ratingRows,
    operatorProfileRows,
    clientRows,
    operatorRows,
    preferenceRows,
    documentRows,
    invoiceRows,
    paymentRows,
    payoutRows,
    checklistRows,
    auditRows,
    exportRows
  });
}

export interface LiveAdminRows {
  admin: AdminIdentity;
  organizationRows: Row[];
  membershipRows: Row[];
  profileRows: Row[];
  eventRows: Row[];
  jobRows: Row[];
  applicationRows: Row[];
  ratingRows: Row[];
  operatorProfileRows: Row[];
  clientRows: Row[];
  operatorRows: Row[];
  preferenceRows: Row[];
  documentRows: Row[];
  invoiceRows: Row[];
  paymentRows: Row[];
  payoutRows: Row[];
  checklistRows: Row[];
  auditRows: Row[];
  exportRows: Row[];
  now?: number;
}

// Pure so it can be unit tested without a database.
export function buildLiveAdminDataset(rows: LiveAdminRows): AdminDataset {
  const now = rows.now ?? Date.now();
  const currentYear = new Date(now).getUTCFullYear();
  const currentMonthKey = monthKey(new Date(now));

  const profiles = rows.profileRows.map(mapProfileRow);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const staffProfiles = profiles.filter((profile) => profile.role === "staff");
  const ratings = rows.ratingRows.map(mapRatingRow);
  const eventsById = new Map(rows.eventRows.map((row) => [str(row.id), row]));
  const organizationsById = new Map(rows.organizationRows.map((row) => [str(row.id), row]));
  const operatorProfilesById = new Map(rows.operatorProfileRows.map((row) => [str(row.profile_id), row]));

  // Admin detail rows, keyed by the marketplace id they belong to.
  const clientDetailByOrgId = new Map<string, Row>();
  const orgIdByClientRowId = new Map<string, string>();
  for (const row of rows.clientRows) {
    const organizationId = str(row.organization_id);
    if (!organizationId) continue;
    clientDetailByOrgId.set(organizationId, row);
    orgIdByClientRowId.set(str(row.id), organizationId);
  }

  const operatorDetailByUserId = new Map<string, Row>();
  const userIdByOperatorRowId = new Map<string, string>();
  for (const row of rows.operatorRows) {
    const userId = str(row.user_id);
    if (!userId) continue;
    operatorDetailByUserId.set(userId, row);
    userIdByOperatorRowId.set(str(row.id), userId);
  }

  // The client's main contact is the earliest "owner" member, else the earliest member.
  const ownerByOrgId = new Map<string, Profile>();
  const sortedMemberships = [...rows.membershipRows].sort(
    (left, right) =>
      Number(right.role === "owner") - Number(left.role === "owner") ||
      str(left.created_at).localeCompare(str(right.created_at))
  );
  for (const membership of sortedMemberships) {
    const organizationId = str(membership.organization_id);
    const profile = profilesById.get(str(membership.profile_id));
    if (profile && !ownerByOrgId.has(organizationId)) {
      ownerByOrgId.set(organizationId, profile);
    }
  }

  const applicationsByJobId = new Map<string, Row[]>();
  for (const application of rows.applicationRows) {
    const bucket = applicationsByJobId.get(str(application.job_id)) ?? [];
    bucket.push(application);
    applicationsByJobId.set(str(application.job_id), bucket);
  }

  const rankingRows = buildRankedStaff(staffProfiles, ratings);
  const rankingByStaffId = new Map(rankingRows.map((row) => [row.staffId, row]));

  // Preferences (favourite / blocked), mapped back to organisation and staff ids.
  const favouritesByOrg = new Map<string, Set<string>>();
  const blockedByOrg = new Map<string, Set<string>>();
  for (const preference of rows.preferenceRows) {
    const organizationId = orgIdByClientRowId.get(str(preference.client_id));
    const staffId = userIdByOperatorRowId.get(str(preference.operator_id));
    if (!organizationId || !staffId) continue;
    const target = preference.preference === "blocked" ? blockedByOrg : favouritesByOrg;
    const bucket = target.get(organizationId) ?? new Set<string>();
    bucket.add(staffId);
    target.set(organizationId, bucket);
  }

  // Assignments from jobs.
  const assignments: AssignmentSummary[] = rows.jobRows
    .map((job) => {
      const event = eventsById.get(str(job.event_id)) ?? {};
      const organizationId = str(job.organization_id);
      const organization = organizationsById.get(organizationId) ?? {};
      const applications = applicationsByJobId.get(str(job.id)) ?? [];
      const assignedHeadcount = applications.filter((entry) => entry.status === "accepted").length;
      const requiredHeadcount = Math.max(num(job.positions_needed), 1);
      const startsAt = str(job.shift_start);
      const endsAt = str(job.shift_end);
      const durationHours = toCurrency(hoursBetween(startsAt, endsAt));
      const payRate = num(job.pay_rate);
      const chargeRate = num(job.charge_rate);
      const labourCost = toCurrency(payRate * requiredHeadcount * durationHours);
      const totalChargeAmount = toCurrency(chargeRate * requiredHeadcount * durationHours);
      const totalPayAmount = toCurrency(payRate * assignedHeadcount * durationHours);

      return {
        id: str(job.id),
        eventId: str(job.event_id),
        eventTitle: str(event.title),
        eventType: str(event.event_type),
        clientId: organizationId,
        clientName: str(organization.name, "Unknown client"),
        title: str(job.title),
        description: str(job.description),
        roleType: str(job.role_type),
        locationName: str(event.location),
        startsAt,
        endsAt,
        durationHours,
        status: determineAssignmentStatus({
          jobStatus: str(job.status),
          startsAt,
          endsAt,
          assignedHeadcount,
          requiredHeadcount,
          now
        }),
        requiredHeadcount,
        assignedHeadcount,
        applicantCount: applications.filter((entry) => entry.status !== "withdrawn").length,
        payRate,
        chargeRate,
        labourCost,
        techRentalCost: 0,
        techRentalItems: [],
        athenaServiceCharge: toCurrency(Math.max(totalChargeAmount - labourCost, 0)),
        totalChargeAmount,
        totalPayAmount,
        fillRate: assignedHeadcount / requiredHeadcount,
        repeatOperatorsAvailable: (favouritesByOrg.get(organizationId) ?? new Set()).size
      } satisfies AssignmentSummary;
    })
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

  const assignmentsByClientId = new Map<string, AssignmentSummary[]>();
  const acceptedAssignmentsByStaffId = new Map<string, AssignmentSummary[]>();
  for (const assignment of assignments) {
    const bucket = assignmentsByClientId.get(assignment.clientId) ?? [];
    bucket.push(assignment);
    assignmentsByClientId.set(assignment.clientId, bucket);

    for (const application of applicationsByJobId.get(assignment.id) ?? []) {
      if (application.status !== "accepted") continue;
      const staffId = str(application.staff_id);
      const staffBucket = acceptedAssignmentsByStaffId.get(staffId) ?? [];
      staffBucket.push(assignment);
      acceptedAssignmentsByStaffId.set(staffId, staffBucket);
    }
  }

  // Money.
  const invoicesByOrgId = new Map<string, ClientFinancialRecord[]>();
  const allInvoices: Array<ClientFinancialRecord & { clientId: string }> = [];
  for (const row of rows.invoiceRows) {
    const organizationId = orgIdByClientRowId.get(str(row.client_id));
    if (!organizationId) continue;
    const record = buildInvoiceRecord(row, now);
    const bucket = invoicesByOrgId.get(organizationId) ?? [];
    bucket.push(record);
    invoicesByOrgId.set(organizationId, bucket);
    allInvoices.push({ ...record, clientId: organizationId });
  }

  const paymentsByOrgId = new Map<string, ClientPaymentRecord[]>();
  const allPayments: ClientPaymentRecord[] = [];
  for (const row of rows.paymentRows) {
    const organizationId = orgIdByClientRowId.get(str(row.client_id));
    if (!organizationId) continue;
    const record: ClientPaymentRecord = {
      id: str(row.id),
      clientId: organizationId,
      invoiceId: row.invoice_id ? str(row.invoice_id) : undefined,
      amount: toCurrency(num(row.amount)),
      paymentDate: str(row.payment_date),
      paymentMethod: str(row.payment_method, "bank_transfer"),
      externalReference: str(row.external_reference)
    };
    const bucket = paymentsByOrgId.get(organizationId) ?? [];
    bucket.push(record);
    paymentsByOrgId.set(organizationId, bucket);
    allPayments.push(record);
  }

  const paidPayoutsByStaffId = new Map<string, number>();
  for (const row of rows.payoutRows) {
    const staffId = userIdByOperatorRowId.get(str(row.operator_id));
    if (!staffId || row.status !== "paid") continue;
    const paidAt = row.paid_at ? new Date(str(row.paid_at)) : null;
    if (!paidAt || paidAt.getUTCFullYear() !== currentYear) continue;
    paidPayoutsByStaffId.set(staffId, (paidPayoutsByStaffId.get(staffId) ?? 0) + num(row.gross_amount));
  }

  const isBilled = (invoice: ClientFinancialRecord) => invoice.status !== "draft";

  // Operators.
  const ratingsByStaffId = new Map<string, number[]>();
  for (const rating of ratings) {
    const bucket = ratingsByStaffId.get(rating.staffId) ?? [];
    bucket.push(rating.rating);
    ratingsByStaffId.set(rating.staffId, bucket);
  }

  const operators: OperatorSummary[] = staffProfiles.map((profile) => {
    const detail = operatorDetailByUserId.get(profile.id) ?? {};
    const operatorProfile = operatorProfilesById.get(profile.id) ?? {};
    const accepted = acceptedAssignmentsByStaffId.get(profile.id) ?? [];
    const completed = accepted.filter((assignment) => assignment.status === "completed");
    const clientIds = new Set(accepted.map((assignment) => assignment.clientId));
    const ratingValues = ratingsByStaffId.get(profile.id) ?? [];
    const averageRating = ratingValues.length
      ? toCurrency(ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length)
      : 0;
    const favouriteCount = [...favouritesByOrg.values()].filter((set) => set.has(profile.id)).length;
    const blockedCount = [...blockedByOrg.values()].filter((set) => set.has(profile.id)).length;
    const completedThisYear = completed.filter(
      (assignment) => new Date(assignment.endsAt).getUTCFullYear() === currentYear
    );
    const earnedFromShifts = completedThisYear.reduce(
      (sum, assignment) => sum + assignment.payRate * assignment.durationHours,
      0
    );
    const regions = Array.isArray(detail.regions) && detail.regions.length
      ? detail.regions.map(String)
      : [str(operatorProfile.base_location ?? profile.location)].filter(Boolean);

    return {
      id: profile.id,
      userId: profile.id,
      displayName: str(operatorProfile.display_name, profile.fullName) || profile.fullName,
      email: profile.email,
      verificationStatus: pick(detail.verification_status, VERIFICATION_STATUSES, "pending"),
      onboardingStatus: pick(operatorProfile.onboarding_status, ONBOARDING_STATUSES, "pending"),
      regions,
      skillTags: profile.skills,
      averageRating,
      totalCompleted: completed.length,
      totalCancellations: num(detail.total_cancellations),
      totalNoShows: num(detail.total_no_shows),
      repeatClients: clientIds.size,
      favouriteCount,
      blockedCount,
      complaintCount: ratings.filter((rating) => rating.staffId === profile.id && rating.rating <= 2).length,
      earningsYtd: toCurrency(paidPayoutsByStaffId.get(profile.id) ?? earnedFromShifts),
      isActive: detail.is_active === undefined ? true : Boolean(detail.is_active),
      latestAssignmentAt: [...accepted].sort(
        (left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime()
      )[0]?.startsAt,
      notes: splitNotes(detail.notes)
    } satisfies OperatorSummary;
  });
  const operatorsById = new Map(operators.map((operator) => [operator.id, operator]));

  // Clients.
  const clients: ClientSummary[] = rows.organizationRows.map((organization) => {
    const organizationId = str(organization.id);
    const detail = clientDetailByOrgId.get(organizationId) ?? {};
    const owner = ownerByOrgId.get(organizationId);
    const clientAssignments = assignmentsByClientId.get(organizationId) ?? [];
    const invoices = (invoicesByOrgId.get(organizationId) ?? []).filter(isBilled);
    const acceptedByOperator = new Map<string, number>();
    for (const assignment of clientAssignments) {
      for (const application of applicationsByJobId.get(assignment.id) ?? []) {
        if (application.status !== "accepted") continue;
        const staffId = str(application.staff_id);
        acceptedByOperator.set(staffId, (acceptedByOperator.get(staffId) ?? 0) + 1);
      }
    }
    const repeatOperators = [...acceptedByOperator.values()].filter((count) => count > 1).length;
    const lastActivity = [organization.created_at, ...clientAssignments.map((assignment) => assignment.startsAt)]
      .map((value) => str(value))
      .filter(Boolean)
      .sort()
      .at(-1);

    return {
      id: organizationId,
      companyName: str(detail.company_name, str(organization.name)) || str(organization.name),
      tradingName: detail.trading_name ? str(detail.trading_name) : undefined,
      primaryContactName: str(detail.primary_contact_name, owner?.fullName ?? ""),
      primaryContactEmail: str(detail.primary_contact_email, owner?.email ?? ""),
      billingContactEmail: str(detail.billing_contact_email, owner?.email ?? ""),
      status: pick(detail.status, CLIENT_STATUSES, "active"),
      onboardingStatus: pick(organization.onboarding_status, ONBOARDING_STATUSES, "pending"),
      signupDate: str(organization.created_at),
      activeAssignments: clientAssignments.filter((assignment) =>
        ACTIVE_ASSIGNMENT_STATUSES.includes(assignment.status)
      ).length,
      futureAssignments: clientAssignments.filter(
        (assignment) => new Date(assignment.startsAt).getTime() > now
      ).length,
      lifetimeSpend: toCurrency(invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)),
      monthlySpend: toCurrency(
        invoices
          .filter((invoice) => invoice.issueDate.slice(0, 7) === currentMonthKey)
          .reduce((sum, invoice) => sum + invoice.totalAmount, 0)
      ),
      outstandingBalance: toCurrency(invoices.reduce((sum, invoice) => sum + invoice.balance, 0)),
      repeatBookingRate: acceptedByOperator.size
        ? Math.round((repeatOperators / acceptedByOperator.size) * 100)
        : 0,
      favouriteOperators: (favouritesByOrg.get(organizationId) ?? new Set()).size,
      blockedOperators: (blockedByOrg.get(organizationId) ?? new Set()).size,
      lastActivityAt: lastActivity ?? str(organization.created_at),
      notes: splitNotes(detail.notes)
    } satisfies ClientSummary;
  });

  // Audit trail.
  const auditEntries: AuditEntry[] = rows.auditRows.map((row) => {
    const actor = profilesById.get(str(row.actor_profile_id));
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      id: str(row.id),
      actorName: actor?.fullName ?? "System",
      action: str(row.action),
      entityType: str(row.entity_type),
      entityLabel: str(metadata.label, str(row.entity_id)),
      createdAt: str(row.created_at),
      metadata: str(metadata.summary)
    };
  });
  const auditByEntity = (entityType: string, entityId: string) =>
    rows.auditRows
      .filter((row) => row.entity_type === entityType && str(row.entity_id) === entityId)
      .map((row) => auditEntries.find((entry) => entry.id === str(row.id))!)
      .filter(Boolean);

  // Detail views.
  const assignmentDetails: Record<string, AssignmentDetail> = {};
  for (const assignment of assignments) {
    const applications = applicationsByJobId.get(assignment.id) ?? [];
    const applicants: AssignmentApplicant[] = applications
      .filter((application) => application.status !== "withdrawn")
      .map((application) => {
        const operator = operatorsById.get(str(application.staff_id));
        return {
          operatorId: str(application.staff_id),
          operatorName: operator?.displayName ?? "Unknown operator",
          status:
            application.status === "accepted"
              ? "accepted"
              : application.status === "rejected"
                ? "rejected"
                : "applied",
          rating: operator?.averageRating ?? 0
        };
      });

    assignmentDetails[assignment.id] = {
      ...assignment,
      applicants,
      assignedTeam: applications
        .filter((application) => application.status === "accepted")
        .map((application) => operatorsById.get(str(application.staff_id)))
        .filter((operator): operator is OperatorSummary => Boolean(operator)),
      favouriteOperatorMatches: [...(favouritesByOrg.get(assignment.clientId) ?? new Set<string>())]
        .map((staffId) => operatorsById.get(staffId))
        .filter((operator): operator is OperatorSummary => Boolean(operator)),
      auditEntries: auditByEntity("assignment", assignment.id),
      feedback: ratings
        .filter((rating) => rating.jobId === assignment.id)
        .map((rating) => ({
          operatorName: operatorsById.get(rating.staffId)?.displayName ?? "Unknown operator",
          rating: rating.rating,
          reviewText: rating.comment
        }))
    };
  }

  const documentsByStaffId = new Map<string, OperatorDocument[]>();
  for (const row of rows.documentRows) {
    const staffId = userIdByOperatorRowId.get(str(row.operator_id));
    if (!staffId) continue;
    const bucket = documentsByStaffId.get(staffId) ?? [];
    bucket.push({
      id: str(row.id),
      documentType: str(row.document_type),
      verificationStatus: pick(row.verification_status, VERIFICATION_STATUSES, "pending"),
      expiresAt: row.expires_at ? str(row.expires_at) : undefined,
      reviewedAt: row.reviewed_at ? str(row.reviewed_at) : undefined
    });
    documentsByStaffId.set(staffId, bucket);
  }

  const operatorDetails: Record<string, OperatorDetail> = {};
  for (const operator of operators) {
    const operatorAssignments = acceptedAssignmentsByStaffId.get(operator.id) ?? [];
    operatorDetails[operator.id] = {
      ...operator,
      completionRate:
        operator.totalCompleted / Math.max(operator.totalCompleted + operator.totalCancellations, 1),
      assignments: operatorAssignments,
      repeatClientNames: [...new Set(operatorAssignments.map((assignment) => assignment.clientName))],
      favouritedByClients: clients
        .filter((entry) => favouritesByOrg.get(entry.id)?.has(operator.id))
        .map((entry) => entry.companyName),
      documents: documentsByStaffId.get(operator.id) ?? [],
      auditEntries: auditByEntity("operator", operator.id)
    };
  }

  const clientDetails: Record<string, ClientDetail> = {};
  for (const summary of clients) {
    const detail = clientDetailByOrgId.get(summary.id) ?? {};
    const owner = ownerByOrgId.get(summary.id);
    clientDetails[summary.id] = {
      ...summary,
      billingContactName: str(detail.billing_contact_name, summary.primaryContactName),
      primaryContactPhone: str(detail.primary_contact_phone, owner?.phone ?? ""),
      billingContactPhone: str(detail.billing_contact_phone, str(detail.primary_contact_phone, owner?.phone ?? "")),
      address: [detail.address_line_1, detail.address_line_2, detail.city, detail.region, detail.postcode, detail.country]
        .map((part) => str(part).trim())
        .filter(Boolean)
        .join(", "),
      paymentHistory: (paymentsByOrgId.get(summary.id) ?? []).sort((left, right) =>
        right.paymentDate.localeCompare(left.paymentDate)
      ),
      assignments: assignmentsByClientId.get(summary.id) ?? [],
      preferredOperators: [...(favouritesByOrg.get(summary.id) ?? new Set<string>())]
        .map((staffId) => operatorsById.get(staffId))
        .filter((operator): operator is OperatorSummary => Boolean(operator)),
      blockedOperatorProfiles: [...(blockedByOrg.get(summary.id) ?? new Set<string>())]
        .map((staffId) => operatorsById.get(staffId))
        .filter((operator): operator is OperatorSummary => Boolean(operator)),
      auditEntries: auditByEntity("client", summary.id)
    };
  }

  // Finance.
  const billedInvoices = allInvoices.filter(isBilled);
  const outstandingInvoices = billedInvoices
    .filter((invoice) => invoice.balance > 0)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const collectedByMonth = new Map<string, number>();
  for (const payment of allPayments) {
    const key = payment.paymentDate.slice(0, 7);
    collectedByMonth.set(key, (collectedByMonth.get(key) ?? 0) + payment.amount);
  }
  const clientsById = new Map(clients.map((entry) => [entry.id, entry]));
  const topRevenueClients = clients
    .map((entry) => ({ clientId: entry.id, companyName: entry.companyName, totalSpend: entry.lifetimeSpend }))
    .filter((entry) => entry.totalSpend > 0)
    .sort((left, right) => right.totalSpend - left.totalSpend);

  const finance: FinanceSummary = {
    totalBilled: toCurrency(billedInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)),
    totalCollected: toCurrency(allPayments.reduce((sum, payment) => sum + payment.amount, 0)),
    totalOutstanding: toCurrency(outstandingInvoices.reduce((sum, invoice) => sum + invoice.balance, 0)),
    monthlyRevenue: toCurrency(collectedByMonth.get(currentMonthKey) ?? 0),
    topRevenueClients,
    outstandingInvoices
  };

  // Onboarding queue.
  const checklistsByEntity = new Map<string, Array<{ label: string; completed: boolean }>>();
  for (const row of rows.checklistRows) {
    const key = `${str(row.entity_type)}:${str(row.entity_id)}`;
    const bucket = checklistsByEntity.get(key) ?? [];
    bucket.push({ label: str(row.label), completed: Boolean(row.completed) });
    checklistsByEntity.set(key, bucket);
  }

  const onboarding: OnboardingItem[] = [
    ...clients.map((entry) => {
      const detail = clientDetailByOrgId.get(entry.id) ?? {};
      return {
        id: `onboarding_client_${entry.id}`,
        entityType: "client" as const,
        entityId: entry.id,
        entityName: entry.companyName,
        status: entry.onboardingStatus,
        owner: entry.primaryContactName,
        updatedAt: str(detail.updated_at, entry.signupDate),
        checklist: checklistsByEntity.get(`client:${entry.id}`) ?? [
          { label: "Account created", completed: true },
          { label: "Billing contact added", completed: Boolean(detail.billing_contact_email) },
          { label: "First assignment posted", completed: (assignmentsByClientId.get(entry.id) ?? []).length > 0 },
          { label: "Approved by Athena", completed: entry.onboardingStatus === "approved" }
        ]
      };
    }),
    ...operators.map((operator) => {
      const documents = documentsByStaffId.get(operator.id) ?? [];
      const operatorProfile = operatorProfilesById.get(operator.id) ?? {};
      return {
        id: `onboarding_operator_${operator.id}`,
        entityType: "operator" as const,
        entityId: operator.id,
        entityName: operator.displayName,
        status: operator.onboardingStatus,
        owner: "Operations desk",
        updatedAt: str(operatorProfile.updated_at, profilesById.get(operator.id)?.createdAt ?? ""),
        checklist: checklistsByEntity.get(`operator:${operator.id}`) ?? [
          { label: "Profile created", completed: true },
          { label: "Documents uploaded", completed: documents.length > 0 },
          { label: "Identity verified", completed: operator.verificationStatus === "verified" },
          { label: "Approved for live assignments", completed: operator.onboardingStatus === "approved" }
        ]
      };
    })
  ].sort((left, right) => {
    const pendingFirst = Number(left.status === "approved") - Number(right.status === "approved");
    return pendingFirst || right.updatedAt.localeCompare(left.updatedAt);
  });

  // Dashboard.
  const weekAhead = now + 1000 * 60 * 60 * 24 * 7;
  const underFilledSoon = assignments.filter(
    (assignment) =>
      ["open", "partially_filled"].includes(assignment.status) &&
      new Date(assignment.startsAt).getTime() <= weekAhead
  );
  const pendingOnboarding = onboarding.filter((item) => item.status === "pending" || item.status === "in_review");
  const unverifiedActive = operators.filter(
    (operator) => operator.isActive && operator.verificationStatus !== "verified" && operator.totalCompleted > 0
  );
  const overdue = outstandingInvoices.filter((invoice) => invoice.status === "overdue");

  const alerts: AdminAlert[] = [
    ...overdue.slice(0, 3).map((invoice) => {
      const owner = allInvoices.find((entry) => entry.invoiceId === invoice.invoiceId);
      const clientName = owner ? clientsById.get(owner.clientId)?.companyName ?? "A client" : "A client";
      return {
        id: `alert_invoice_${invoice.invoiceId}`,
        type: "balance" as const,
        label: `${clientName} has an overdue invoice`,
        href: "/admin/finance",
        severity: "high" as const,
        context: `Invoice ${invoice.invoiceNumber} was due ${invoice.dueDate.slice(0, 10)}.`
      };
    }),
    ...underFilledSoon.slice(0, 3).map((assignment) => ({
      id: `alert_assignment_${assignment.id}`,
      type: "assignment" as const,
      label: `${assignment.eventTitle || assignment.title} is under-filled`,
      href: `/admin/assignments/${assignment.id}`,
      severity: "high" as const,
      context: `${assignment.assignedHeadcount} of ${assignment.requiredHeadcount} confirmed, starts ${assignment.startsAt.slice(0, 10)}.`
    })),
    ...(pendingOnboarding.length
      ? [
          {
            id: "alert_onboarding_queue",
            type: "onboarding" as const,
            label: `${pendingOnboarding.length} onboarding ${pendingOnboarding.length === 1 ? "record needs" : "records need"} review`,
            href: "/admin/onboarding",
            severity: "medium" as const,
            context: "Approve or reject them so they can be booked."
          }
        ]
      : []),
    ...(unverifiedActive.length
      ? [
          {
            id: "alert_operator_verification",
            type: "operator" as const,
            label: `${unverifiedActive.length} working ${unverifiedActive.length === 1 ? "operator is" : "operators are"} not verified`,
            href: "/admin/operators",
            severity: "medium" as const,
            context: "They have completed shifts but their identity checks are incomplete."
          }
        ]
      : [])
  ];

  const months = lastMonths(6);
  const revenueSeries: AdminChartPoint[] = months.map((month) => ({
    label: month.label,
    value: Math.round(collectedByMonth.get(month.key) ?? 0)
  }));

  const countStatus = (status: AssignmentStatus) =>
    assignments.filter((assignment) => assignment.status === status).length;

  const topRanked = rankingRows.filter((row) => row.reviewCount > 0);

  const exports: ExportJob[] = rows.exportRows.map((row) => ({
    id: str(row.id),
    exportType: str(row.export_type),
    format: pick(row.format, ["csv", "json", "xlsx"] as const, "csv"),
    status: pick(row.status, ["queued", "processing", "completed", "failed"] as const, "queued"),
    requestedBy: profilesById.get(str(row.requested_by))?.fullName ?? "Admin",
    createdAt: str(row.created_at),
    completedAt: row.completed_at ? str(row.completed_at) : undefined
  }));

  return {
    admin: rows.admin,
    dashboard: {
      kpis: {
        totalClients: clients.length,
        activeClients: clients.filter((entry) => entry.status === "active").length,
        totalOperators: operators.length,
        verifiedOperators: operators.filter((operator) => operator.verificationStatus === "verified").length,
        openAssignments: countStatus("open"),
        filledAssignments: assignments.filter((assignment) =>
          ["filled", "partially_filled", "in_progress"].includes(assignment.status)
        ).length,
        completedAssignments: countStatus("completed"),
        cancelledAssignments: countStatus("cancelled"),
        monthlyRevenue: finance.monthlyRevenue,
        outstandingBalances: finance.totalOutstanding,
        repeatBookingRate: clients.length
          ? Math.round(clients.reduce((sum, entry) => sum + entry.repeatBookingRate, 0) / clients.length)
          : 0,
        topClient: topRevenueClients[0]?.companyName ?? "None yet",
        topOperator: topRanked[0]?.profile.fullName ?? "None yet"
      },
      topClients: topRevenueClients.slice(0, 3),
      topOperators: topRanked.slice(0, 4).map((row) => ({
        operatorId: row.staffId,
        displayName: operatorsById.get(row.staffId)?.displayName ?? row.profile.fullName,
        rankingScore: Number(row.weightedScore.toFixed(4)),
        averageRating: row.averageRating
      })),
      alerts,
      revenueSeries,
      assignmentSeries: [
        { label: "Open", value: countStatus("open") + countStatus("partially_filled") },
        { label: "Filled", value: countStatus("filled") },
        { label: "In progress", value: countStatus("in_progress") },
        { label: "Completed", value: countStatus("completed") }
      ],
      overdueBalances: overdue.slice(0, 4),
      onboardingQueue: pendingOnboarding.slice(0, 6)
    },
    clients: [...clients].sort((left, right) => right.lifetimeSpend - left.lifetimeSpend || left.companyName.localeCompare(right.companyName)),
    clientDetails,
    operators: [...operators].sort((left, right) => right.averageRating - left.averageRating || left.displayName.localeCompare(right.displayName)),
    operatorDetails,
    assignments,
    assignmentDetails,
    finance,
    onboarding,
    // Campaigns, templates and deliveries are read live by lib/services/admin-communications.
    campaigns: [],
    campaignDetails: {},
    emailTemplates: DEFAULT_EMAIL_TEMPLATES,
    emailDeliveries: [],
    exports,
    auditEntries
  };
}
