import { cache } from "react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getRuntimeMode } from "@/lib/env";
import { loadLiveAdminDataset } from "@/lib/queries/admin-live";
import { buildBaseDemoDatabase } from "@/lib/data/demo-seed";
import { buildRankedStaff } from "@/lib/domain/ranking";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email/catalog";
import type {
  AdminDataset,
  AssignmentApplicant,
  AssignmentDetail,
  AssignmentStatus,
  AssignmentSummary,
  AuditEntry,
  CampaignDetail,
  CampaignSummary,
  ClientStatus,
  ClientDetail,
  ClientFinancialRecord,
  ClientPaymentRecord,
  ClientSummary,
  FinanceSummary,
  OnboardingStatus,
  OnboardingItem,
  OperatorDetail,
  OperatorDocument,
  OperatorSummary,
  VerificationStatus
} from "@/types/admin";

const REGION_ROTATION = [
  ["London Central", "Canary Wharf"],
  ["Brighton", "South Coast"],
  ["Manchester", "North West"],
  ["Birmingham", "Midlands"]
] as const;

const CLIENT_CONFIG: Record<
  string,
  {
    status: ClientStatus;
    onboardingStatus: OnboardingStatus;
    favourites: string[];
    blocked: string[];
    notes: string[];
    address: string;
  }
> = {
  org_ember: {
    status: "active",
    onboardingStatus: "in_review",
    favourites: ["user_staff_3", "user_staff_7"],
    blocked: ["user_staff_10"],
    notes: [
      "Wants premium guest handling covered by repeat operators when possible.",
      "Finance flagged the latest invoice for staged payment."
    ],
    address: "18 Curtain Road, Shoreditch, London EC2A 3LT"
  },
  org_harbour: {
    status: "active",
    onboardingStatus: "approved",
    favourites: ["user_staff_10", "user_staff_11", "user_staff_12"],
    blocked: ["user_staff_8"],
    notes: [
      "High-volume summer calendar. Often needs manual support on large stewarding briefs.",
      "Has strong repeat-booking behaviour with front-of-house talent."
    ],
    address: "45 Kings Road Arches, Brighton BN1 1NB"
  },
  org_nova: {
    status: "at_risk",
    onboardingStatus: "approved",
    favourites: ["user_staff_1", "user_staff_3", "user_staff_9"],
    blocked: ["user_staff_4"],
    notes: [
      "Commercially valuable account but slower payer than target terms.",
      "Leadership wants more account-touch before the next expo cycle."
    ],
    address: "12 St Ann Street, Manchester M2 7LF"
  }
};

const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  "open",
  "partially_filled",
  "filled",
  "in_progress"
];

const VERIFICATION_SEQUENCE: VerificationStatus[] = [
  "verified",
  "verified",
  "verified",
  "in_review",
  "verified",
  "pending",
  "verified",
  "verified",
  "verified",
  "in_review",
  "verified",
  "pending"
];

const ONBOARDING_SEQUENCE = [
  "approved",
  "approved",
  "approved",
  "in_review",
  "approved",
  "pending",
  "approved",
  "approved",
  "approved",
  "in_review",
  "approved",
  "pending"
] as const;

const TECH_RENTAL_PRESETS: Record<
  string,
  {
    multiplier: number;
    items: string[];
  }
> = {
  "Brand launch": {
    multiplier: 0.11,
    items: ["Wireless comms pack", "Guest check-in tablets", "Accent lighting kit"]
  },
  Corporate: {
    multiplier: 0.08,
    items: ["Badge printer", "Lectern audio support", "Registration iPads"]
  },
  Music: {
    multiplier: 0.15,
    items: ["Radio fleet", "Back-of-house comms", "Portable scanning devices"]
  },
  Fashion: {
    multiplier: 0.13,
    items: ["Guestlist tablets", "POS terminal", "Backstage comms"]
  },
  Expo: {
    multiplier: 0.14,
    items: ["Accreditation printers", "Lead capture tablets", "Wayfinding screens"]
  },
  Retail: {
    multiplier: 0.09,
    items: ["Stock scanner", "Demo tablets", "Portable till kit"]
  }
};

function getTechRentalProfile(eventType: string, roleType: string) {
  const preset = TECH_RENTAL_PRESETS[eventType] ?? {
    multiplier: 0.1,
    items: ["Operations comms kit", "Portable check-in tablet"]
  };

  const roleSpecificItems =
    roleType.toLowerCase().includes("bartender") || roleType.toLowerCase().includes("bar")
      ? ["Mobile bar POS"]
      : roleType.toLowerCase().includes("registration") || roleType.toLowerCase().includes("accreditation")
        ? ["Badge issue station"]
        : roleType.toLowerCase().includes("steward") || roleType.toLowerCase().includes("security")
          ? ["Radio earpiece set"]
          : roleType.toLowerCase().includes("brand")
            ? ["Lead capture handset"]
            : [];

  return {
    multiplier: preset.multiplier,
    items: [...new Set([...preset.items, ...roleSpecificItems])]
  };
}

function toCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function toPercent(value: number) {
  return Math.round(value * 100);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hoursBetween(start: string, end: string) {
  const milliseconds = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(milliseconds / (1000 * 60 * 60), 1);
}

function determineAssignmentStatus(
  startsAt: string,
  endsAt: string,
  assignedHeadcount: number,
  requiredHeadcount: number
): AssignmentStatus {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();

  if (end < now) {
    return "completed";
  }

  if (start <= now && end >= now) {
    return "in_progress";
  }

  if (assignedHeadcount >= requiredHeadcount) {
    return "filled";
  }

  if (assignedHeadcount > 0) {
    return "partially_filled";
  }

  return "open";
}

function buildInvoiceStatus(balance: number, dueDate: string) {
  if (balance <= 0) {
    return "paid" as const;
  }

  if (new Date(dueDate).getTime() < Date.now()) {
    return "overdue" as const;
  }

  return "part_paid" as const;
}

export const getAdminDataset = cache(async (): Promise<AdminDataset> => {
  if (getRuntimeMode() === "live") {
    const { adminUser } = await requireAdmin();
    return loadLiveAdminDataset(adminUser);
  }

  return buildDemoAdminDataset();
});

function buildDemoAdminDataset(): AdminDataset {
  const database = buildBaseDemoDatabase();
  const membershipsByProfileId = new Map(
    database.organizationMemberships.map((membership) => [membership.profileId, membership])
  );
  const organizationsById = new Map(
    database.organizations.map((organization) => [organization.id, organization])
  );
  const profilesById = new Map(database.profiles.map((profile) => [profile.id, profile]));
  const applicationsByJobId = new Map<string, typeof database.applications>();

  for (const application of database.applications) {
    const bucket = applicationsByJobId.get(application.jobId) ?? [];
    bucket.push(application);
    applicationsByJobId.set(application.jobId, bucket);
  }

  const rankingRows = buildRankedStaff(
    database.profiles.filter((profile) => profile.role === "staff"),
    database.ratings
  );
  const rankingScoreByStaffId = new Map(
    rankingRows.map((row) => [row.staffId, Number(row.weightedScore.toFixed(4))])
  );

  const ratingsByStaffId = new Map<string, number[]>();
  for (const rating of database.ratings) {
    const values = ratingsByStaffId.get(rating.staffId) ?? [];
    values.push(rating.rating);
    ratingsByStaffId.set(rating.staffId, values);
  }

  const assignments: AssignmentSummary[] = database.jobs.map((job) => {
    const event = database.events.find((entry) => entry.id === job.eventId)!;
    const organization = organizationsById.get(job.organizationId)!;
    const applications = applicationsByJobId.get(job.id) ?? [];
    const accepted = applications.filter((entry) => entry.status === "accepted");
    const assignedHeadcount = accepted.length;
    const requiredHeadcount = job.positionsNeeded;
    const durationHours = hoursBetween(job.shiftStart, job.shiftEnd);
    const labourCost = toCurrency(job.payRate * requiredHeadcount * durationHours);
    const techRental = getTechRentalProfile(event.eventType, job.roleType);
    const techRentalCost = toCurrency(labourCost * techRental.multiplier);
    const chargeAmount = toCurrency(job.payRate * 1.82 * requiredHeadcount * durationHours);
    const athenaServiceCharge = toCurrency(Math.max(chargeAmount - labourCost - techRentalCost, 0));
    const payAmount = toCurrency(job.payRate * Math.max(assignedHeadcount, 1) * durationHours);
    const status = determineAssignmentStatus(
      job.shiftStart,
      job.shiftEnd,
      assignedHeadcount,
      requiredHeadcount
    );
    const clientPreferences = CLIENT_CONFIG[job.organizationId];

    return {
      id: job.id,
      eventId: event.id,
      eventTitle: event.title,
      eventType: event.eventType,
      clientId: organization.id,
      clientName: organization.name,
      title: job.title,
      description: job.description,
      roleType: job.roleType,
      locationName: event.location,
      startsAt: job.shiftStart,
      endsAt: job.shiftEnd,
      durationHours,
      status,
      requiredHeadcount,
      assignedHeadcount,
      applicantCount: applications.length,
      payRate: job.payRate,
      chargeRate: toCurrency(chargeAmount / Math.max(requiredHeadcount * durationHours, 1)),
      labourCost,
      techRentalCost,
      techRentalItems: techRental.items,
      athenaServiceCharge,
      totalChargeAmount: chargeAmount,
      totalPayAmount: payAmount,
      fillRate: assignedHeadcount / requiredHeadcount,
      repeatOperatorsAvailable: clientPreferences.favourites.length
    };
  });

  const assignmentsById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const assignmentsByClientId = new Map<string, AssignmentSummary[]>();
  const acceptedAssignmentsByOperatorId = new Map<string, AssignmentSummary[]>();

  for (const assignment of assignments) {
    const clientBucket = assignmentsByClientId.get(assignment.clientId) ?? [];
    clientBucket.push(assignment);
    assignmentsByClientId.set(assignment.clientId, clientBucket);

    const applications = applicationsByJobId.get(assignment.id) ?? [];
    for (const application of applications.filter((entry) => entry.status === "accepted")) {
      const operatorBucket = acceptedAssignmentsByOperatorId.get(application.staffId) ?? [];
      operatorBucket.push(assignment);
      acceptedAssignmentsByOperatorId.set(application.staffId, operatorBucket);
    }
  }

  const operators: OperatorSummary[] = database.profiles
    .filter((profile) => profile.role === "staff")
    .map((profile, index) => {
      const acceptedAssignments = acceptedAssignmentsByOperatorId.get(profile.id) ?? [];
      const completedAssignments = acceptedAssignments.filter(
        (assignment) => assignment.status === "completed"
      );
      const clientIds = new Set(acceptedAssignments.map((assignment) => assignment.clientId));
      const favouriteCount = Object.values(CLIENT_CONFIG).filter((config) =>
        config.favourites.includes(profile.id)
      ).length;
      const blockedCount = Object.values(CLIENT_CONFIG).filter((config) =>
        config.blocked.includes(profile.id)
      ).length;
      const complaintCount = blockedCount + (index % 4 === 0 ? 1 : 0);
      const ratings = ratingsByStaffId.get(profile.id) ?? [];
      const averageRating = Number(average(ratings).toFixed(2));
      const earningsYtd = toCurrency(
        acceptedAssignments.reduce((sum, assignment) => sum + assignment.totalPayAmount, 0)
      );

      return {
        id: profile.id,
        userId: profile.id,
        displayName: profile.fullName,
        email: profile.email,
        verificationStatus: VERIFICATION_SEQUENCE[index] ?? "pending",
        onboardingStatus: ONBOARDING_SEQUENCE[index] ?? "pending",
        regions: [...REGION_ROTATION[index % REGION_ROTATION.length]],
        skillTags: profile.skills,
        averageRating,
        totalCompleted: completedAssignments.length,
        totalCancellations: index % 5 === 0 ? 1 : 0,
        totalNoShows: index % 7 === 0 ? 1 : 0,
        repeatClients: clientIds.size,
        favouriteCount,
        blockedCount,
        complaintCount,
        earningsYtd,
        isActive: index !== 9,
        latestAssignmentAt: acceptedAssignments[0]?.startsAt,
        notes: [
          `Primary strengths: ${profile.skills.slice(0, 2).join(", ")}.`,
          index % 3 === 0
            ? "Needs closer compliance follow-up before high-profile placements."
            : "Strong candidate for repeat client matching."
        ]
      };
    });

  const operatorsById = new Map(operators.map((operator) => [operator.id, operator]));

  const operatorDocumentsById = new Map<string, OperatorDocument[]>();
  for (const operator of operators) {
    operatorDocumentsById.set(operator.id, [
      {
        id: `${operator.id}_doc_id`,
        documentType: "ID check",
        verificationStatus: operator.verificationStatus,
        reviewedAt: operator.verificationStatus === "verified" ? new Date().toISOString() : undefined
      },
      {
        id: `${operator.id}_doc_rtw`,
        documentType: "Right to work",
        verificationStatus:
          operator.verificationStatus === "pending" ? "pending" : "verified",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString()
      },
      {
        id: `${operator.id}_doc_compliance`,
        documentType: "Ops briefing acknowledgement",
        verificationStatus:
          operator.onboardingStatus === "approved" ? "verified" : "in_review"
      }
    ]);
  }

  const clientInvoices = new Map<string, ClientFinancialRecord[]>();
  const clientPayments = new Map<string, ClientPaymentRecord[]>();

  const clients: ClientSummary[] = database.organizations.map((organization, index) => {
    const membership = database.organizationMemberships.find(
      (entry) => entry.organizationId === organization.id
    )!;
    const owner = profilesById.get(membership.profileId)!;
    const clientAssignments = assignmentsByClientId.get(organization.id) ?? [];
    const lifetimeSpend = toCurrency(
      clientAssignments.reduce((sum, assignment) => sum + assignment.totalChargeAmount, 0)
    );
    const monthlySpend = toCurrency(lifetimeSpend * (0.22 + index * 0.08));
    const activeAssignments = clientAssignments.filter((assignment) =>
      ACTIVE_ASSIGNMENT_STATUSES.includes(assignment.status)
    ).length;
    const futureAssignments = clientAssignments.filter(
      (assignment) => new Date(assignment.startsAt).getTime() > Date.now()
    ).length;
    const config = CLIENT_CONFIG[organization.id];
    const firstInvoiceTotal = toCurrency(lifetimeSpend * 0.58);
    const secondInvoiceTotal = toCurrency(lifetimeSpend * 0.42);
    const secondInvoicePaid = index === 0 ? toCurrency(secondInvoiceTotal * 0.5) : index === 1 ? 0 : toCurrency(secondInvoiceTotal * 0.2);

    const invoices: ClientFinancialRecord[] = [
      {
        invoiceId: `${organization.id}_inv_1`,
        invoiceNumber: `ATH-${1200 + index}`,
        issueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * (42 - index * 5)).toISOString(),
        dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * (28 - index * 4)).toISOString(),
        totalAmount: firstInvoiceTotal,
        amountPaid: firstInvoiceTotal,
        balance: 0,
        status: "paid"
      },
      {
        invoiceId: `${organization.id}_inv_2`,
        invoiceNumber: `ATH-${1210 + index}`,
        issueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * (15 - index * 2)).toISOString(),
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * (3 - index * 4)).toISOString(),
        totalAmount: secondInvoiceTotal,
        amountPaid: secondInvoicePaid,
        balance: toCurrency(secondInvoiceTotal - secondInvoicePaid),
        status: buildInvoiceStatus(
          toCurrency(secondInvoiceTotal - secondInvoicePaid),
          new Date(Date.now() + 1000 * 60 * 60 * 24 * (3 - index * 4)).toISOString()
        )
      }
    ];

    const payments: ClientPaymentRecord[] = invoices
      .filter((invoice) => invoice.amountPaid > 0)
      .map((invoice, paymentIndex) => ({
        id: `${invoice.invoiceId}_payment_${paymentIndex + 1}`,
        clientId: organization.id,
        invoiceId: invoice.invoiceId,
        amount: invoice.amountPaid,
        paymentDate: new Date(
          new Date(invoice.issueDate).getTime() + 1000 * 60 * 60 * 24 * 8
        ).toISOString(),
        paymentMethod: paymentIndex === 0 ? "bank_transfer" : "card",
        externalReference: `PAY-${organization.slug.toUpperCase()}-${paymentIndex + 1}`
      }));

    clientInvoices.set(organization.id, invoices);
    clientPayments.set(organization.id, payments);

    return {
      id: organization.id,
      companyName: organization.name,
      tradingName: `${organization.name} Events`,
      primaryContactName: owner.fullName,
      primaryContactEmail: owner.email,
      billingContactEmail: owner.email.replace("@", "+billing@"),
      status: config.status,
      onboardingStatus: config.onboardingStatus,
      signupDate: organization.createdAt,
      activeAssignments,
      futureAssignments,
      lifetimeSpend,
      monthlySpend,
      outstandingBalance: invoices.reduce((sum, invoice) => sum + invoice.balance, 0),
      repeatBookingRate: 62 + index * 11,
      favouriteOperators: config.favourites.length,
      blockedOperators: config.blocked.length,
      lastActivityAt: clientAssignments[0]?.startsAt ?? organization.createdAt,
      notes: [...config.notes]
    };
  });

  const clientsById = new Map(clients.map((client) => [client.id, client]));

  const auditEntries: AuditEntry[] = [
    {
      id: "audit_1",
      actorName: "Ariana Beck",
      action: "Updated assignment",
      entityType: "assignment",
      entityLabel: "London Rooftop Launch / VIP Host",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      metadata: "Headcount increased from 2 to 3 after client approval."
    },
    {
      id: "audit_2",
      actorName: "Marcus Hale",
      action: "Triggered payment reminder",
      entityType: "invoice",
      entityLabel: "ATH-1211",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      metadata: "Second reminder sent to Harbour Live finance contact."
    },
    {
      id: "audit_3",
      actorName: "Ariana Beck",
      action: "Approved onboarding",
      entityType: "operator",
      entityLabel: "Chloe Ross",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
      metadata: "Compliance documents reviewed and profile activated."
    },
    {
      id: "audit_4",
      actorName: "Selene Ward",
      action: "Scheduled campaign",
      entityType: "campaign",
      entityLabel: "April reactivation push",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 44).toISOString(),
      metadata: "Audience: inactive operators, scheduled for Monday at 08:30."
    },
    {
      id: "audit_5",
      actorName: "Marcus Hale",
      action: "Created export",
      entityType: "report",
      entityLabel: "Finance ageing snapshot",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      metadata: "CSV export generated for leadership review."
    }
  ];

  const assignmentDetails: Record<string, AssignmentDetail> = {};
  for (const assignment of assignments) {
    const applications = applicationsByJobId.get(assignment.id) ?? [];
    const applicants: AssignmentApplicant[] = applications.map((application) => {
      const operator = operatorsById.get(application.staffId)!;
      return {
        operatorId: operator.id,
        operatorName: operator.displayName,
        status:
          application.status === "pending"
            ? "applied"
            : application.status === "accepted"
              ? "accepted"
              : application.status === "rejected"
                ? "rejected"
                : "waitlisted",
        rating: operator.averageRating
      };
    });
    const assignedTeam = applications
      .filter((application) => application.status === "accepted")
      .map((application) => operatorsById.get(application.staffId)!)
      .filter(Boolean);
    const clientConfig = CLIENT_CONFIG[assignment.clientId];
    const favouriteOperatorMatches = clientConfig.favourites
      .map((operatorId) => operatorsById.get(operatorId))
      .filter((operator): operator is OperatorSummary => Boolean(operator));
    const relatedRatings = database.ratings
      .filter((rating) => {
        const job = database.jobs.find((entry) => entry.id === assignment.id)!;
        return rating.eventId === job.eventId;
      })
      .map((rating) => ({
        operatorName: profilesById.get(rating.staffId)?.fullName ?? "Unknown operator",
        rating: rating.rating,
        reviewText: rating.comment
      }));

    assignmentDetails[assignment.id] = {
      ...assignment,
      applicants,
      assignedTeam,
      favouriteOperatorMatches,
      auditEntries: auditEntries.filter((entry) => entry.entityType === "assignment").slice(0, 2),
      feedback: relatedRatings
    };
  }

  const operatorDetails: Record<string, OperatorDetail> = {};
  for (const operator of operators) {
    const operatorAssignments = acceptedAssignmentsByOperatorId.get(operator.id) ?? [];
    const repeatClientNames = [
      ...new Set(operatorAssignments.map((assignment) => assignment.clientName))
    ];
    const favouritedByClients = clients
      .filter((client) => CLIENT_CONFIG[client.id].favourites.includes(operator.id))
      .map((client) => client.companyName);

    operatorDetails[operator.id] = {
      ...operator,
      completionRate:
        operator.totalCompleted / Math.max(operator.totalCompleted + operator.totalCancellations, 1),
      assignments: operatorAssignments,
      repeatClientNames,
      favouritedByClients,
      documents: operatorDocumentsById.get(operator.id) ?? [],
      auditEntries: auditEntries.filter(
        (entry) => entry.entityType === "operator" || entry.entityLabel === operator.displayName
      )
    };
  }

  const clientDetails: Record<string, ClientDetail> = {};
  for (const client of clients) {
    const ownerMembership = database.organizationMemberships.find(
      (entry) => entry.organizationId === client.id
    )!;
    const owner = profilesById.get(ownerMembership.profileId)!;
    const clientConfig = CLIENT_CONFIG[client.id];
    clientDetails[client.id] = {
      ...client,
      billingContactName: `${owner.fullName} Finance`,
      primaryContactPhone: owner.phone ?? "020 7946 0000",
      billingContactPhone: owner.phone ?? "020 7946 0000",
      address: clientConfig.address,
      paymentHistory: clientPayments.get(client.id) ?? [],
      assignments: assignmentsByClientId.get(client.id) ?? [],
      preferredOperators: clientConfig.favourites
        .map((operatorId) => operatorsById.get(operatorId))
        .filter((operator): operator is OperatorSummary => Boolean(operator)),
      blockedOperatorProfiles: clientConfig.blocked
        .map((operatorId) => operatorsById.get(operatorId))
        .filter((operator): operator is OperatorSummary => Boolean(operator)),
      auditEntries: auditEntries.filter((entry) =>
        entry.entityLabel.toLowerCase().includes(client.companyName.split(" ")[0].toLowerCase())
      )
    };
  }

  const outstandingInvoices = clients
    .flatMap((client) => clientInvoices.get(client.id) ?? [])
    .filter((invoice) => invoice.balance > 0)
    .sort((left, right) => right.balance - left.balance);

  const finance: FinanceSummary = {
    totalBilled: toCurrency(
      clients.flatMap((client) => clientInvoices.get(client.id) ?? []).reduce((sum, invoice) => sum + invoice.totalAmount, 0)
    ),
    totalCollected: toCurrency(
      clients.flatMap((client) => clientPayments.get(client.id) ?? []).reduce((sum, payment) => sum + payment.amount, 0)
    ),
    totalOutstanding: toCurrency(outstandingInvoices.reduce((sum, invoice) => sum + invoice.balance, 0)),
    monthlyRevenue: toCurrency(clients.reduce((sum, client) => sum + client.monthlySpend, 0)),
    topRevenueClients: clients
      .map((client) => ({
        clientId: client.id,
        companyName: client.companyName,
        totalSpend: client.lifetimeSpend
      }))
      .sort((left, right) => right.totalSpend - left.totalSpend),
    outstandingInvoices
  };

  const onboarding: OnboardingItem[] = [
    ...clients.map((client) => ({
      id: `onboarding_client_${client.id}`,
      entityType: "client" as const,
      entityId: client.id,
      entityName: client.companyName,
      status: client.onboardingStatus,
      owner: client.primaryContactName,
      updatedAt: client.lastActivityAt,
      checklist: [
        { label: "Profile created", completed: true },
        { label: "Billing contact added", completed: true },
        { label: "Invite sent", completed: client.onboardingStatus !== "pending" },
        { label: "First assignment created", completed: client.activeAssignments > 0 }
      ]
    })),
    ...operators
      .filter((operator) => operator.onboardingStatus !== "approved" || operator.verificationStatus !== "verified")
      .map((operator) => ({
        id: `onboarding_operator_${operator.id}`,
        entityType: "operator" as const,
        entityId: operator.id,
        entityName: operator.displayName,
        status: operator.onboardingStatus,
        owner: "Operations Desk",
        updatedAt: operator.latestAssignmentAt ?? new Date().toISOString(),
        checklist: [
          { label: "Profile created", completed: true },
          { label: "ID document uploaded", completed: true },
          { label: "Compliance review", completed: operator.verificationStatus !== "pending" },
          { label: "Approved for live assignments", completed: operator.verificationStatus === "verified" }
        ]
      }))
  ].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  const campaigns: CampaignSummary[] = [
    {
      id: "campaign_april_ops",
      name: "April reactivation push",
      subject: "Ready for next week’s premium assignments?",
      previewText: "Fresh assignment access and readiness reminders for field operators.",
      audience: "operators",
      templateType: "newsletter",
      marketingCategory: "news",
      segmentKey: "inactive_operators",
      status: "scheduled",
      contentMode: "markdown",
      htmlContent: "<h1>Ready for next week’s premium assignments?</h1><p>Fresh opportunities are now opening across Athena Pro.</p>",
      markdownContent:
        "# Ready for next week’s premium assignments?\nFresh opportunities are now opening across Athena Pro.",
      contentJson:
        '[{"id":"block_1","type":"markdown","content":"# Ready for next week’s premium assignments?\\nFresh opportunities are now opening across Athena Pro."}]',
      scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 18).toISOString(),
      audienceCount: operators.filter((operator) => operator.totalCompleted < 2).length,
      openRate: 0,
      clickRate: 0
    },
    {
      id: "campaign_finance_clients",
      name: "Quarterly client update",
      subject: "New reporting, faster fills, tighter oversight",
      previewText: "Highlights for commercial and finance stakeholders.",
      audience: "clients",
      templateType: "newsletter",
      marketingCategory: "updates",
      segmentKey: "active_clients",
      status: "sent",
      contentMode: "rich",
      htmlContent:
        "<h1>New reporting, faster fills, tighter oversight</h1><p>Operational updates for Athena Pro clients.</p>",
      markdownContent:
        "# New reporting, faster fills, tighter oversight\nOperational updates for Athena Pro clients.",
      contentJson:
        '[{"id":"block_2","type":"heading","content":"New reporting, faster fills, tighter oversight"}]',
      sentAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      audienceCount: clients.filter((client) => client.status === "active").length,
      openRate: 61,
      clickRate: 19
    },
    {
      id: "campaign_dual_news",
      name: "Platform bulletin",
      subject: "April Athena operations bulletin",
      previewText: "Operational news for clients and operators.",
      audience: "both",
      templateType: "newsletter",
      marketingCategory: "news",
      segmentKey: "all",
      status: "draft",
      contentMode: "markdown",
      htmlContent: "<h1>April Athena operations bulletin</h1><p>Platform news for clients and operators.</p>",
      markdownContent: "# April Athena operations bulletin\nPlatform news for clients and operators.",
      contentJson:
        '[{"id":"block_3","type":"markdown","content":"# April Athena operations bulletin\\nPlatform news for clients and operators."}]',
      audienceCount: clients.length + operators.length,
      openRate: 0,
      clickRate: 0
    }
  ];

  const campaignDetails: Record<string, CampaignDetail> = Object.fromEntries(
    campaigns.map((campaign) => [
      campaign.id,
      {
        ...campaign,
        recipientBreakdown:
          campaign.audience === "both"
            ? [
                { label: "Clients", count: clients.length },
                { label: "Operators", count: operators.length }
              ]
            : [
                {
                  label: campaign.audience === "clients" ? "Clients" : "Operators",
                  count: campaign.audienceCount
                }
              ]
      }
    ])
  );

  const emailTemplates = DEFAULT_EMAIL_TEMPLATES;
  const emailDeliveries = [
    {
      id: "delivery_1",
      templateType: "newsletter" as const,
      campaignId: "campaign_finance_clients",
      recipientEmail: clients[0]?.primaryContactEmail ?? "client@example.com",
      recipientName: clients[0]?.primaryContactName ?? "Client contact",
      subject: "New reporting, faster fills, tighter oversight",
      provider: "smtp2go",
      status: "sent" as const,
      category: "marketing" as const,
      lastEvent: "sent",
      lastEventAt: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString(),
      sentAt: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
    },
    {
      id: "delivery_2",
      templateType: "promotion" as const,
      recipientEmail: operators[0]?.email ?? "operator@example.com",
      recipientName: operators[0]?.displayName ?? "Operator",
      subject: "Athena Pro status update",
      provider: "smtp2go",
      status: "queued" as const,
      category: "marketing" as const,
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
    }
  ];

  const exports = [
    {
      id: "export_1",
      exportType: "finance_summary",
      format: "csv" as const,
      status: "completed" as const,
      requestedBy: "Marcus Hale",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 20 + 1000 * 60 * 4).toISOString()
    },
    {
      id: "export_2",
      exportType: "operator_rankings",
      format: "json" as const,
      status: "processing" as const,
      requestedBy: "Ariana Beck",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
    },
    {
      id: "export_3",
      exportType: "client_directory",
      format: "xlsx" as const,
      status: "queued" as const,
      requestedBy: "Selene Ward",
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    }
  ];

  const dashboard = {
    kpis: {
      totalClients: clients.length,
      activeClients: clients.filter((client) => client.status === "active").length,
      totalOperators: operators.length,
      verifiedOperators: operators.filter((operator) => operator.verificationStatus === "verified").length,
      openAssignments: assignments.filter((assignment) => assignment.status === "open").length,
      filledAssignments: assignments.filter((assignment) =>
        ["filled", "partially_filled", "in_progress"].includes(assignment.status)
      ).length,
      completedAssignments: assignments.filter((assignment) => assignment.status === "completed").length,
      cancelledAssignments: assignments.filter((assignment) => assignment.status === "cancelled").length,
      monthlyRevenue: finance.monthlyRevenue,
      outstandingBalances: finance.totalOutstanding,
      repeatBookingRate: toPercent(
        clients.reduce((sum, client) => sum + client.repeatBookingRate / 100, 0) / Math.max(clients.length, 1)
      ),
      topClient: finance.topRevenueClients[0]?.companyName ?? "None",
      topOperator:
        rankingRows[0]?.profile.fullName ??
        operators.sort((left, right) => right.averageRating - left.averageRating)[0]?.displayName ??
        "None"
    },
    topClients: finance.topRevenueClients.slice(0, 3),
    topOperators: rankingRows.slice(0, 4).map((row) => ({
      operatorId: row.staffId,
      displayName: row.profile.fullName,
      rankingScore: rankingScoreByStaffId.get(row.staffId) ?? 0,
      averageRating: row.averageRating
    })),
    alerts: [
      {
        id: "alert_balance_nova",
        type: "balance" as const,
        label: "Nova Occasions has an overdue balance",
        href: "/admin/finance",
        severity: "high" as const,
        context: "Invoice ATH-1212 is now past due and only 20 percent settled."
      },
      {
        id: "alert_assignment_ember",
        type: "assignment" as const,
        label: "London Rooftop Launch is still under-filled",
        href: "/admin/assignments/job_1",
        severity: "high" as const,
        context: "One of three required operators is confirmed."
      },
      {
        id: "alert_onboarding_ops",
        type: "onboarding" as const,
        label: "Three onboarding records require review",
        href: "/admin/onboarding",
        severity: "medium" as const,
        context: "Pending operator approvals are blocking next-week availability."
      },
      {
        id: "alert_operator_risk",
        type: "operator" as const,
        label: "Two operators carry compliance risk",
        href: "/admin/operators",
        severity: "medium" as const,
        context: "Verification is incomplete but those profiles are active in matching pools."
      }
    ],
    revenueSeries: [
      { label: "Jan", value: 11200 },
      { label: "Feb", value: 13600 },
      { label: "Mar", value: 14800 },
      { label: "Apr", value: Math.round(finance.monthlyRevenue) }
    ],
    assignmentSeries: [
      { label: "Open", value: assignments.filter((assignment) => assignment.status === "open").length },
      {
        label: "Filled",
        value: assignments.filter((assignment) => assignment.status === "filled").length
      },
      {
        label: "In progress",
        value: assignments.filter((assignment) => assignment.status === "in_progress").length
      },
      {
        label: "Completed",
        value: assignments.filter((assignment) => assignment.status === "completed").length
      }
    ],
    overdueBalances: outstandingInvoices.slice(0, 4),
    onboardingQueue: onboarding.slice(0, 6)
  };

  return {
    admin: {
      id: "admin_demo_super",
      fullName: "Ariana Beck",
      email: "ariana@athena.internal",
      adminRole: "super_admin",
      isActive: true
    },
    dashboard,
    clients: clients.sort((left, right) => right.lifetimeSpend - left.lifetimeSpend),
    clientDetails,
    operators: operators.sort((left, right) => right.averageRating - left.averageRating),
    operatorDetails,
    assignments: assignments.sort(
      (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
    ),
    assignmentDetails,
    finance,
    onboarding,
    campaigns,
    campaignDetails,
    emailTemplates,
    emailDeliveries,
    exports,
    auditEntries
  };
}
