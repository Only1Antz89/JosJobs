// @ts-nocheck
import { buildStaffJobsBoardItems, buildSuggestedJobMap, buildTrendingSignals, filterJobs } from "@/lib/domain/jobs-board";
import { buildAiSuggestedEventMetadata, buildSuggestedJobsForOperator, buildSuggestedOperatorsForJob } from "@/lib/domain/matching";
import { buildPerformanceSummary, buildRankedStaff, buildRatingSummaries } from "@/lib/domain/ranking";
import { AppError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/email/marketing";
import { getBrowserSupabaseClient } from "@/lib/data/supabase-client";
import type { StaffBookDataProvider } from "@/lib/data/contracts";
import type {
  Application,
  ApplicationStatus,
  AuthSession,
  BrowseJobsFilters,
  EnrichedApplication,
  EnrichedJob,
  Event,
  JobAlert,
  JobStatus,
  JobViewEvent,
  MarketingPreference,
  Notification,
  OperatorAvailabilityRule,
  OperatorProfile,
  OperatorWorkspaceData,
  Organization,
  Profile,
  RankedStaffRow,
  Rating,
  StaffDashboardData,
  StaffJobsBoardData,
  StaffDirectoryFilters
} from "@/types/domain";
import type {
  ClientFeedbackInput,
  CreateEventInput,
  CreateJobInput,
  JobApplicationInput,
  JobAlertInput,
  LoginInput,
  OperatorReviewInput,
  OrganiserSignupInput,
  PasswordResetRequestInput,
  StaffSignupInput,
  UpdateEmailInput,
  UpdateMarketingPreferencesInput,
  UpdateOperatorAvailabilityInput,
  UpdateOperatorProfileInput,
  UpdatePasswordInput
} from "@/lib/validation/schemas";

async function getSessionOrThrow() {
  const client: any = getBrowserSupabaseClient();
  const {
    data: { session }
  } = await client.auth.getSession();

  if (!session?.user) {
    throw new AppError("You must be signed in.", "UNAUTHENTICATED", 401);
  }

  return session;
}

async function registerLiveAccount(input: OrganiserSignupInput | StaffSignupInput) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new AppError(payload?.error ?? "Unable to create account.", "SIGNUP_FAILED", response.status);
  }

  return payload as {
    userId: string;
    role: Profile["role"];
    email: string;
  };
}

const JOB_VIEW_DEDUPLICATION_WINDOW_MS = 6 * 60 * 60 * 1000;

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    role: row.role as Profile["role"],
    fullName: String(row.full_name),
    email: String(row.email),
    phone: row.phone ? String(row.phone) : undefined,
    companyName: row.company_name ? String(row.company_name) : undefined,
    bio: row.bio ? String(row.bio) : undefined,
    skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
    availability: row.availability ? String(row.availability) : undefined,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
    location: row.location ? String(row.location) : undefined,
    languages: Array.isArray(row.languages) ? row.languages.map(String) : undefined,
    preferredRoles: Array.isArray(row.preferred_roles) ? row.preferred_roles.map(String) : undefined,
    age: row.age ? Number(row.age) : undefined,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapOperatorProfile(row: Record<string, unknown> | null): OperatorProfile | null {
  if (!row) {
    return null;
  }

  return {
    profileId: String(row.profile_id),
    displayName: String(row.display_name ?? ""),
    headline: row.headline ? String(row.headline) : undefined,
    baseLocation: row.base_location ? String(row.base_location) : undefined,
    details: row.details ? String(row.details) : undefined,
    preferredRoles: Array.isArray(row.preferred_roles) ? row.preferred_roles.map(String) : [],
    languages: Array.isArray(row.languages) ? row.languages.map(String) : [],
    canDrive: Boolean(row.can_drive),
    dateOfBirth: row.date_of_birth ? String(row.date_of_birth) : undefined,
    age: row.age ? Number(row.age) : undefined,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
    availabilitySummary: row.availability_summary ? String(row.availability_summary) : undefined,
    stripeAccountStatus: row.stripe_account_status ? String(row.stripe_account_status) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString())
  };
}

function mapOrganization(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    createdAt: String(row.created_at)
  };
}

function mapEvent(row: Record<string, unknown>): Event {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    createdBy: String(row.created_by),
    title: String(row.title),
    description: String(row.description ?? ""),
    location: String(row.location ?? ""),
    eventDate: String(row.event_date),
    eventType: String(row.event_type ?? ""),
    requiredRoles: Array.isArray(row.required_roles) ? row.required_roles.map(String) : [],
    serviceTier: (row.service_tier ?? "mixed") as Event["serviceTier"],
    serviceTierSource: (row.service_tier_source ?? "default") as Event["serviceTierSource"],
    suggestedServiceTier: row.suggested_service_tier ? String(row.suggested_service_tier) : undefined,
    aiSuggestedTags: Array.isArray(row.ai_suggested_tags) ? row.ai_suggested_tags.map(String) : [],
    aiSuggestedRoles: Array.isArray(row.ai_suggested_roles) ? row.ai_suggested_roles.map(String) : [],
    status: row.status as Event["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapJob(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    organizationId: String(row.organization_id),
    createdBy: String(row.created_by),
    title: String(row.title),
    description: String(row.description ?? ""),
    roleType: String(row.role_type ?? ""),
    shiftStart: String(row.shift_start),
    shiftEnd: String(row.shift_end),
    payRate: Number(row.pay_rate ?? 0),
    positionsNeeded: Number(row.positions_needed ?? 1),
    minimumAge: row.minimum_age === null || row.minimum_age === undefined ? null : Number(row.minimum_age),
    status: row.status as EnrichedJob["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapApplication(row: Record<string, unknown>): Application {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    staffId: String(row.staff_id),
    status: row.status as Application["status"],
    coverNote: String(row.cover_note ?? ""),
    appliedAt: String(row.applied_at),
    updatedAt: String(row.updated_at)
  };
}

function mapRating(row: Record<string, unknown>): Rating {
  const overallScore = Number(row.overall_score ?? row.rating ?? 0);

  return {
    id: String(row.id),
    eventId: String(row.event_id),
    jobId: String(row.job_id ?? ""),
    organizationId: String(row.organization_id),
    staffId: String(row.staff_id),
    organiserId: String(row.organiser_id),
    reliabilityScore: Number(row.reliability_score ?? overallScore),
    professionalismScore: Number(row.professionalism_score ?? overallScore),
    communicationScore: Number(row.communication_score ?? overallScore),
    customerServiceScore: Number(row.customer_service_score ?? overallScore),
    pressureHandlingScore: Number(row.pressure_handling_score ?? overallScore),
    overallScore,
    rating: overallScore,
    comment: String(row.comment ?? ""),
    createdAt: String(row.created_at)
  };
}

function mapAvailabilityRule(row: Record<string, unknown>): OperatorAvailabilityRule {
  return {
    id: String(row.id),
    operatorId: String(row.operator_id),
    dayOfWeek: Number(row.day_of_week),
    isAvailable: Boolean(row.is_available),
    isAllDay: Boolean(row.is_all_day),
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : undefined,
    endTime: row.end_time ? String(row.end_time).slice(0, 5) : undefined
  };
}

function mapNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: row.type as Notification["type"],
    title: String(row.title),
    body: String(row.body),
    href: row.href ? String(row.href) : undefined,
    isRead: Boolean(row.is_read),
    createdAt: String(row.created_at),
    emailStatus: row.email_status ? String(row.email_status) : undefined
  };
}

function mapJobViewEvent(row: Record<string, unknown>): JobViewEvent {
  return {
    id: String(row.id ?? ""),
    jobId: String(row.job_id),
    viewerId: String(row.viewer_id),
    viewedAt: String(row.viewed_at)
  };
}

function mapJobAlert(row: Record<string, unknown>): JobAlert {
  return {
    id: String(row.id),
    staffId: String(row.staff_id),
    name: String(row.name ?? "Saved search"),
    query: row.query ? String(row.query) : undefined,
    location: row.location ? String(row.location) : undefined,
    roleTypes: Array.isArray(row.role_types) ? row.role_types.map(String) : [],
    minimumPay: row.minimum_pay === null || row.minimum_pay === undefined ? null : Number(row.minimum_pay),
    dateFrom: row.date_from ? String(row.date_from) : undefined,
    dateTo: row.date_to ? String(row.date_to) : undefined,
    isActive: Boolean(row.is_active),
    emailOptIn: Boolean(row.email_opt_in),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function isMissingRelationError(error: unknown) {
  const message = String((error as { message?: unknown } | null)?.message ?? "");
  const code = String((error as { code?: unknown } | null)?.code ?? "");
  return code === "42P01" || message.includes("does not exist") || message.includes("Could not find the table");
}

function mapMarketingPreference(row: Record<string, unknown> | null, profileId: string): MarketingPreference {
  if (!row) {
    const now = new Date().toISOString();

    return {
      profileId,
      emailNormalized: undefined,
      newsletterOptIn: false,
      offersOptIn: false,
      productUpdatesOptIn: false,
      newsletterOptedOutAt: now,
      marketingOptedOutAt: now,
      source: "default",
      createdAt: now,
      updatedAt: now
    };
  }

  return {
    profileId: String(row.profile_id ?? profileId),
    emailNormalized: row.email_normalized ? String(row.email_normalized) : undefined,
    newsletterOptIn: Boolean(row.newsletter_opt_in),
    offersOptIn: Boolean(row.offers_opt_in),
    productUpdatesOptIn: Boolean(row.product_updates_opt_in),
    newsletterOptedInAt: row.newsletter_opted_in_at ? String(row.newsletter_opted_in_at) : undefined,
    newsletterOptedOutAt: row.newsletter_opted_out_at ? String(row.newsletter_opted_out_at) : undefined,
    marketingOptedOutAt: row.marketing_opted_out_at ? String(row.marketing_opted_out_at) : undefined,
    unsubscribeToken: row.unsubscribe_token ? String(row.unsubscribe_token) : undefined,
    source: String(row.source ?? "profile_settings"),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString())
  };
}

async function getCurrentProfileOrThrow(client: any, userId: string) {
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).single();

  if (error || !data) {
    throw new AppError("Profile not found.", "PROFILE_NOT_FOUND", 404);
  }

  return mapProfile(data);
}

async function getCurrentOperatorProfile(client: any, userId: string) {
  const result = await client.from("operator_profiles").select("*").eq("profile_id", userId).maybeSingle();
  return mapOperatorProfile(result.data ?? null);
}

async function getNotificationsForUser(client: any, userId: string) {
  const result = await client
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (result.data ?? []).map((row: Record<string, unknown>) => mapNotification(row));
}

async function getMarketingPreferenceForUser(client: any, userId: string) {
  const result = await client.from("marketing_preferences").select("*").eq("profile_id", userId).maybeSingle();
  return mapMarketingPreference(result.data ?? null, userId);
}

async function getAvailabilityRulesForOperator(client: any, operatorId: string) {
  const result = await client
    .from("operator_availability_rules")
    .select("*")
    .eq("operator_id", operatorId)
    .order("day_of_week", { ascending: true });

  return (result.data ?? []).map((row: Record<string, unknown>) => mapAvailabilityRule(row));
}

async function getPublicRatings(client: any) {
  const result = await client.from("ratings").select("*").order("created_at", { ascending: false });
  return (result.data ?? []).map((row: Record<string, unknown>) => mapRating(row));
}

async function getJobRows(client: any, filters?: { id?: string; organizationId?: string; status?: string; limit?: number }) {
  let query = client.from("jobs").select("*, events(*), organizations(*), applications(id)");

  if (filters?.id) {
    query = query.eq("id", filters.id);
  }

  if (filters?.organizationId) {
    query = query.eq("organization_id", filters.organizationId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const result = await query;

  if (result.error) {
    throw new AppError(result.error.message, "SUPABASE_QUERY");
  }

  return result.data ?? [];
}

function toEnrichedJob(row: Record<string, unknown>): EnrichedJob {
  return {
    ...mapJob(row),
    event: mapEvent(row.events as Record<string, unknown>),
    organization: mapOrganization(row.organizations as Record<string, unknown>),
    applicationCount: Array.isArray(row.applications) ? row.applications.length : 0
  };
}

export class SupabaseDataProvider implements StaffBookDataProvider {
  getMode() {
    return "live" as const;
  }

  async getSession(): Promise<AuthSession | null> {
    const client: any = getBrowserSupabaseClient();
    const {
      data: { session }
    } = await client.auth.getSession();

    if (!session?.user) {
      return null;
    }

    const { data, error } = await client
      .from("profiles")
      .select("id, role, email")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      mode: "live" as const,
      userId: String(data.id),
      role: data.role as Profile["role"],
      email: String(data.email)
    };
  }

  async signUpOrganiser(input: OrganiserSignupInput) {
    const client: any = getBrowserSupabaseClient();
    const account = await registerLiveAccount(input);
    const { data, error } = await client.auth.signInWithPassword({
      email: input.email,
      password: input.password
    });

    if (error || !data.session?.user) {
      throw new AppError(error?.message ?? "Account created, but sign-in failed.", "LOGIN_FAILED", 401);
    }

    void fetch("/api/auth/onboarding-email", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        email: input.email,
        fullName: input.fullName,
        role: "organiser",
        companyName: input.companyName
      })
    });

    return {
      mode: "live" as const,
      userId: account.userId,
      role: account.role,
      email: account.email
    };
  }

  async signUpStaff(input: StaffSignupInput) {
    const client: any = getBrowserSupabaseClient();
    const account = await registerLiveAccount(input);
    const { data, error } = await client.auth.signInWithPassword({
      email: input.email,
      password: input.password
    });

    if (error || !data.session?.user) {
      throw new AppError(error?.message ?? "Account created, but sign-in failed.", "LOGIN_FAILED", 401);
    }

    void fetch("/api/auth/onboarding-email", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        email: input.email,
        fullName: input.fullName,
        role: "staff"
      })
    });

    return {
      mode: "live" as const,
      userId: account.userId,
      role: account.role,
      email: account.email
    };
  }

  async signIn(input: LoginInput) {
    const client: any = getBrowserSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: input.email,
      password: input.password
    });

    if (error || !data.session?.user) {
      throw new AppError(error?.message ?? "Unable to sign in.", "LOGIN_FAILED", 401);
    }

    const profile = await getCurrentProfileOrThrow(client, data.session.user.id);

    return {
      mode: "live" as const,
      userId: profile.id,
      role: profile.role,
      email: profile.email
    };
  }

  async signOut() {
    const client: any = getBrowserSupabaseClient();
    await client.auth.signOut();
  }

  async requestPasswordReset(input: PasswordResetRequestInput, redirectTo: string) {
    const response = await fetch("/api/auth/password-reset-request", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: input.email,
        redirectTo
      })
    });

    if (!response.ok) {
      throw new AppError("Unable to request password reset.", "PASSWORD_RESET_REQUEST_FAILED");
    }
  }

  async getCurrentProfile() {
    const session = await this.getSession();

    if (!session) {
      return null;
    }

    const client: any = getBrowserSupabaseClient();
    return getCurrentProfileOrThrow(client, session.userId);
  }

  async getCurrentOperatorProfile() {
    const session = await this.getSession();

    if (!session) {
      return null;
    }

    const client: any = getBrowserSupabaseClient();
    return getCurrentOperatorProfile(client, session.userId);
  }

  async getLandingHighlights() {
    const [featuredJobs, topStaff] = await Promise.all([
      this.getJobs(),
      this.getRankedStaff()
    ]);

    return {
      featuredJobs: featuredJobs.slice(0, 4),
      topStaff: topStaff.slice(0, 4),
      stats: {
        activeJobs: featuredJobs.filter((job) => job.status === "open").length,
        organisers: 0,
        staff: topStaff.length,
        placements: 0
      }
    };
  }

  async getJobs(filters?: BrowseJobsFilters) {
    const client: any = getBrowserSupabaseClient();
    const rows = await getJobRows(client, { status: "open" });

    return filterJobs(
      rows.map((row: Record<string, unknown>) => toEnrichedJob(row)),
      filters
    );
  }

  async getJobById(id: string) {
    const client: any = getBrowserSupabaseClient();
    const rows = await getJobRows(client, { id });
    return rows[0] ? toEnrichedJob(rows[0]) : null;
  }

  async getRankedStaff(filters?: StaffDirectoryFilters): Promise<RankedStaffRow[]> {
    const client: any = getBrowserSupabaseClient();
    const [profilesResult, ratingsResult] = await Promise.all([
      client.from("profiles").select("*").eq("role", "staff"),
      client.from("ratings").select("*")
    ]);

    if (profilesResult.error) {
      throw new AppError(profilesResult.error.message, "SUPABASE_QUERY");
    }

    const ranked = buildRankedStaff(
      (profilesResult.data ?? []).map((row: Record<string, unknown>) => mapProfile(row)),
      (ratingsResult.data ?? []).map((row: Record<string, unknown>) => mapRating(row))
    );

    return ranked.filter((item) => {
      const query = filters?.query?.toLowerCase();
      const skill = filters?.skill?.toLowerCase();
      const availability = filters?.availability?.toLowerCase();

      return (
        (!query ||
          item.profile.fullName.toLowerCase().includes(query) ||
          item.profile.bio?.toLowerCase().includes(query)) &&
        (!skill || item.profile.skills.some((entry) => entry.toLowerCase().includes(skill))) &&
        (!availability || item.profile.availability?.toLowerCase().includes(availability))
      );
    });
  }

  async getOrganiserDashboard() {
    const session = await this.getSession();

    if (!session || session.role !== "organiser") {
      throw new AppError("You must be signed in as an organiser.", "UNAUTHENTICATED", 401);
    }

    const client: any = getBrowserSupabaseClient();
    const membership = await client
      .from("organization_memberships")
      .select("organization_id")
      .eq("profile_id", session.userId)
      .single();

    if (membership.error || !membership.data) {
      throw new AppError("Organisation membership not found.", "ORG_NOT_FOUND", 404);
    }

    const organizationId = String(membership.data.organization_id);
    const [profile, marketingPreference, organizationResult, eventsResult, jobRows, applicationsResult, ratings, rankedStaff, notifications] =
      await Promise.all([
        getCurrentProfileOrThrow(client, session.userId),
        getMarketingPreferenceForUser(client, session.userId),
        client.from("organizations").select("*").eq("id", organizationId).single(),
        client.from("events").select("*").eq("organization_id", organizationId).order("event_date", { ascending: false }),
        getJobRows(client, { organizationId }),
        client.from("applications").select("*").order("applied_at", { ascending: false }),
        getPublicRatings(client),
        this.getRankedStaff(),
        getNotificationsForUser(client, session.userId)
      ]);

    if (organizationResult.error || eventsResult.error || applicationsResult.error) {
      throw new AppError(
        organizationResult.error?.message ??
          eventsResult.error?.message ??
          applicationsResult.error?.message ??
          "Unable to load organiser dashboard.",
        "SUPABASE_QUERY"
      );
    }

    const organization = mapOrganization(organizationResult.data);
    const jobs = jobRows.map((row: Record<string, unknown>) => toEnrichedJob(row));
    const applications = (applicationsResult.data ?? [])
      .map((row: Record<string, unknown>) => mapApplication(row))
      .filter((application: Application) => jobs.some((job) => job.id === application.jobId));
    const recentApplicants = applications
      .slice(0, 5)
      .map((application: Application) => {
        const job = jobs.find((item) => item.id === application.jobId)!;
        const staff = rankedStaff.find((item) => item.staffId === application.staffId)?.profile ?? {
          id: application.staffId,
          role: "staff",
          fullName: "Unknown operator",
          email: "",
          skills: [],
          createdAt: new Date().toISOString()
        };

        return {
          ...application,
          job,
          event: job.event,
          organization: job.organization,
          staff
        } as EnrichedApplication;
      });

    const operatorIds = Array.from(new Set(applications.map((item: Application) => item.staffId)));
    const [operatorProfilesResult, availabilityResult, clientFeedbackResult] = await Promise.all([
      client.from("operator_profiles").select("*").in("profile_id", operatorIds),
      client.from("operator_availability_rules").select("*").in("operator_id", operatorIds),
      client.from("client_feedback").select("*")
    ]);

    const operatorProfiles = new Map(
      (operatorProfilesResult.data ?? []).map((row: Record<string, unknown>) => [
        String(row.profile_id),
        mapOperatorProfile(row)
      ])
    );
    const availabilityRulesByOperatorId = new Map<string, OperatorAvailabilityRule[]>();

    for (const row of availabilityResult.data ?? []) {
      const rule = mapAvailabilityRule(row);
      const bucket = availabilityRulesByOperatorId.get(rule.operatorId) ?? [];
      bucket.push(rule);
      availabilityRulesByOperatorId.set(rule.operatorId, bucket);
    }

    const feedback = (clientFeedbackResult.data ?? []) as any[];
    const operatorSuggestions = Object.fromEntries(
      jobs
        .filter((job) => job.status === "open")
        .map((job) => [
          job.id,
          buildSuggestedOperatorsForJob({
            job,
            operators: rankedStaff,
            operatorProfiles,
            availabilityRulesByOperatorId,
            feedback
          }).slice(0, 5)
        ])
    );
    const ratedKeys = new Set(ratings.map((item: Rating) => `${item.jobId}:${item.staffId}`));
    const ratingQueue = recentApplicants
      .filter(
        (application: EnrichedApplication) =>
          application.status === "accepted" &&
          application.event.status === "completed" &&
          !ratedKeys.has(`${application.job.id}:${application.staff.id}`)
      )
      .map((application: EnrichedApplication) => ({
        event: application.event,
        staff: application.staff,
        application,
        job: application.job
      }));

    return {
      session,
      organization,
      profile,
      marketingPreference,
      stats: {
        upcomingEvents: (eventsResult.data ?? []).filter((event: any) => event.status === "published").length,
        activeJobs: jobs.filter((job) => job.status === "open").length,
        pendingApplicants: recentApplicants.filter((item) => item.status === "pending").length,
        completedEvents: (eventsResult.data ?? []).filter((event: any) => event.status === "completed").length
      },
      events: (eventsResult.data ?? []).map((row: Record<string, unknown>) => mapEvent(row)),
      jobs,
      recentApplicants,
      ratingQueue,
      operatorSuggestions,
      notifications
    };
  }

  async getStaffDashboard(): Promise<StaffDashboardData> {
    const session = await this.getSession();

    if (!session || session.role !== "staff") {
      throw new AppError("You must be signed in as staff.", "UNAUTHENTICATED", 401);
    }

    const client: any = getBrowserSupabaseClient();
    const [profile, operatorProfile, availabilityRules, applicationsResult, ratings, ranked, notifications, feedbackResult] =
      await Promise.all([
        getCurrentProfileOrThrow(client, session.userId),
        getCurrentOperatorProfile(client, session.userId),
        getAvailabilityRulesForOperator(client, session.userId),
        client.from("applications").select("*").eq("staff_id", session.userId).order("applied_at", { ascending: false }),
        getPublicRatings(client),
        this.getRankedStaff(),
        getNotificationsForUser(client, session.userId),
        client.from("client_feedback").select("*").eq("staff_id", session.userId)
      ]);

    if (applicationsResult.error || feedbackResult.error) {
      throw new AppError(
        applicationsResult.error?.message ??
          feedbackResult.error?.message ??
          "Unable to load staff dashboard.",
        "SUPABASE_QUERY"
      );
    }

    const recentApplications = await Promise.all(
      (applicationsResult.data ?? []).slice(0, 5).map(async (applicationRow: Record<string, unknown>) => {
        const application = mapApplication(applicationRow);
        const job = await this.getJobById(application.jobId);

        if (!job) {
          return null;
        }

        return {
          ...application,
          job,
          event: job.event,
          organization: job.organization,
          staff: profile
        } as EnrichedApplication;
      })
    );
    const performanceSummary = buildPerformanceSummary(session.userId, ratings);
    const recommendedJobs = buildSuggestedJobsForOperator({
      jobs: await this.getJobs(),
      profile,
      operatorProfile,
      availabilityRules,
      performance: performanceSummary,
      feedback: feedbackResult.data ?? []
    }).slice(0, 5);
    const recentReviews = ratings
      .filter((rating: Rating) => rating.staffId === session.userId)
      .sort((left: Rating, right: Rating) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    const clientFeedbackQueue = recentApplications
      .filter((application): application is EnrichedApplication => Boolean(application))
      .filter(
        (application) =>
          application.status === "accepted" &&
          application.event.status === "completed" &&
          !(feedbackResult.data ?? []).some((item: any) => item.assignment_id === application.id)
      );

    return {
      session,
      profile,
      operatorProfile,
      performanceSummary,
      ratingSummary: performanceSummary,
      rank: ranked.find((item) => item.profile.id === session.userId)?.rank ?? ranked.length,
      recentApplications: recentApplications.filter(Boolean),
      recommendedJobs,
      reviews: recentReviews,
      notifications,
      clientFeedbackQueue
    };
  }

  async getStaffJobsBoard(): Promise<StaffJobsBoardData> {
    const session = await this.getSession();

    if (!session || session.role !== "staff") {
      throw new AppError("You must be signed in as staff.", "UNAUTHENTICATED", 401);
    }

    const client: any = getBrowserSupabaseClient();
    const [profile, operatorProfile, availabilityRules, jobs, ratings, feedbackResult, ownApplicationsResult, savedJobsResult, alertsResult] =
      await Promise.all([
        getCurrentProfileOrThrow(client, session.userId),
        getCurrentOperatorProfile(client, session.userId),
        getAvailabilityRulesForOperator(client, session.userId),
        this.getJobs(),
        getPublicRatings(client),
        client.from("client_feedback").select("*").eq("staff_id", session.userId),
        client.from("applications").select("id, job_id, status").eq("staff_id", session.userId),
        client.from("saved_jobs").select("job_id").eq("staff_id", session.userId),
        client.from("job_alerts").select("*").eq("staff_id", session.userId).order("updated_at", { ascending: false })
      ]);

    const savedJobsUnavailable = savedJobsResult.error && isMissingRelationError(savedJobsResult.error);
    const alertsUnavailable = alertsResult.error && isMissingRelationError(alertsResult.error);

    if (
      feedbackResult.error ||
      ownApplicationsResult.error ||
      (savedJobsResult.error && !savedJobsUnavailable) ||
      (alertsResult.error && !alertsUnavailable)
    ) {
      throw new AppError(
        feedbackResult.error?.message ??
          ownApplicationsResult.error?.message ??
          (!savedJobsUnavailable ? savedJobsResult.error?.message : undefined) ??
          (!alertsUnavailable ? alertsResult.error?.message : undefined) ??
          "Unable to load staff jobs board.",
        "SUPABASE_QUERY"
      );
    }

    if (jobs.length === 0) {
      return {
        session,
        profile,
        operatorProfile,
        alerts: alertsUnavailable ? [] : (alertsResult.data ?? []).map((row: Record<string, unknown>) => mapJobAlert(row)),
        items: []
      };
    }

    const cutoff72 = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const jobIds = jobs.map((job) => job.id);
    const [applicationsResult, viewEventsResult] = await Promise.all([
      client
        .from("applications")
        .select("job_id, applied_at")
        .in("job_id", jobIds)
        .gte("applied_at", cutoff72),
      client
        .from("job_view_events")
        .select("id, job_id, viewer_id, viewed_at")
        .in("job_id", jobIds)
        .gte("viewed_at", cutoff72)
    ]);

    if (applicationsResult.error || viewEventsResult.error) {
      throw new AppError(
        applicationsResult.error?.message ??
          viewEventsResult.error?.message ??
          "Unable to load staff jobs board activity.",
        "SUPABASE_QUERY"
      );
    }

    const performanceSummary = buildPerformanceSummary(session.userId, ratings);
    const suggestedJobMap = buildSuggestedJobMap(
      buildSuggestedJobsForOperator({
        jobs,
        profile,
        operatorProfile,
        availabilityRules,
        performance: performanceSummary,
        feedback: feedbackResult.data ?? []
      })
    );
    const ownApplicationsByJobId = new Map(
      (ownApplicationsResult.data ?? [])
        .filter((row: Record<string, unknown>) => jobIds.includes(String(row.job_id)))
        .map((row: Record<string, unknown>) => [
          String(row.job_id),
          { id: String(row.id), status: row.status as Application["status"] }
        ])
    );
    const savedJobIds = new Set(
      (savedJobsUnavailable ? [] : (savedJobsResult.data ?? [])).map((row: Record<string, unknown>) => String(row.job_id))
    );
    const recentApplications = (applicationsResult.data ?? []).map((row: Record<string, unknown>) => ({
      jobId: String(row.job_id),
      appliedAt: String(row.applied_at)
    }));
    const recentViewEvents = (viewEventsResult.data ?? []).map((row: Record<string, unknown>) =>
      mapJobViewEvent(row)
    );

    return {
      session,
      profile,
      operatorProfile,
      alerts: alertsUnavailable ? [] : (alertsResult.data ?? []).map((row: Record<string, unknown>) => mapJobAlert(row)),
      items: buildStaffJobsBoardItems(
        jobs.map((job) => {
          const suggestion = suggestedJobMap.get(job.id);
          const ownApplication = ownApplicationsByJobId.get(job.id);

          return {
            job,
            applicationId: ownApplication?.id,
            applicationStatus: ownApplication?.status,
            isSaved: savedJobIds.has(job.id),
            matchScore: suggestion?.score ?? 0,
            matchReasons: suggestion?.reasons ?? [],
            trendingSignals: buildTrendingSignals({
              jobId: job.id,
              applications: recentApplications,
              viewEvents: recentViewEvents
            })
          };
        })
      )
    };
  }

  async getOperatorWorkspace(): Promise<OperatorWorkspaceData> {
    const session = await this.getSession();

    if (!session || session.role !== "staff") {
      throw new AppError("You must be signed in as staff.", "UNAUTHENTICATED", 401);
    }

    const client: any = getBrowserSupabaseClient();
    const [dashboard, paymentResult] = await Promise.all([
      this.getStaffDashboard(),
      client.from("operator_payment_profiles").select("*").eq("operator_id", session.userId).maybeSingle()
    ]);

    return {
      session,
      profile: dashboard.profile,
      operatorProfile:
        dashboard.operatorProfile ?? {
          profileId: session.userId,
          displayName: dashboard.profile.fullName,
          preferredRoles: [],
          languages: ["English"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
      marketingPreference: await getMarketingPreferenceForUser(client, session.userId),
      performanceSummary: dashboard.performanceSummary,
      availabilityRules: await getAvailabilityRulesForOperator(client, session.userId),
      paymentProfile: paymentResult.data
        ? {
            operatorId: String(paymentResult.data.operator_id),
            provider: "stripe",
            accountId: paymentResult.data.account_id ? String(paymentResult.data.account_id) : undefined,
            onboardingStatus: String(paymentResult.data.onboarding_status ?? "not_started"),
            payoutsEnabled: Boolean(paymentResult.data.payouts_enabled),
            detailsSubmitted: Boolean(paymentResult.data.details_submitted),
            lastSyncedAt: paymentResult.data.last_synced_at ? String(paymentResult.data.last_synced_at) : undefined,
            updatedAt: String(paymentResult.data.updated_at ?? new Date().toISOString())
          }
        : {
            operatorId: session.userId,
            provider: "stripe",
            onboardingStatus: "not_started",
            payoutsEnabled: false,
            detailsSubmitted: false,
            updatedAt: new Date().toISOString()
          },
      notifications: dashboard.notifications,
      recentReviews: dashboard.reviews.slice(0, 6),
      clientFeedbackQueue: dashboard.clientFeedbackQueue
    };
  }

  async getNotifications() {
    const session = await getSessionOrThrow();
    const client: any = getBrowserSupabaseClient();
    return getNotificationsForUser(client, session.user.id);
  }

  async getJobAlerts(): Promise<JobAlert[]> {
    const session = await this.getSession();

    if (!session || session.role !== "staff") {
      return [];
    }

    const client: any = getBrowserSupabaseClient();
    const { data, error } = await client
      .from("job_alerts")
      .select("*")
      .eq("staff_id", session.userId)
      .order("updated_at", { ascending: false });

    if (error) {
      if (isMissingRelationError(error)) {
        return [];
      }

      throw new AppError(error.message, "SUPABASE_QUERY");
    }

    return (data ?? []).map((row: Record<string, unknown>) => mapJobAlert(row));
  }

  async createEvent(input: CreateEventInput) {
    const session = await getSessionOrThrow();
    const client: any = getBrowserSupabaseClient();
    const membership = await client
      .from("organization_memberships")
      .select("organization_id")
      .eq("profile_id", session.user.id)
      .single();

    if (membership.error || !membership.data) {
      throw new AppError("Organisation membership not found.", "ORG_NOT_FOUND");
    }

    const aiMetadata = buildAiSuggestedEventMetadata({
      description: input.description,
      eventType: input.eventType,
      requiredRoles: input.requiredRoles.split(",").map((item) => item.trim())
    });

    const { error } = await client.from("events").insert({
      organization_id: membership.data.organization_id,
      created_by: session.user.id,
      title: input.title,
      description: input.description,
      location: input.location,
      event_date: input.eventDate,
      event_type: input.eventType,
      required_roles: input.requiredRoles.split(",").map((item) => item.trim()),
      service_tier: input.serviceTier,
      service_tier_source: "manual",
      suggested_service_tier: aiMetadata.suggestedServiceTier,
      ai_suggested_tags: aiMetadata.aiSuggestedTags,
      ai_suggested_roles: aiMetadata.aiSuggestedRoles,
      status: "published"
    });

    if (error) {
      throw new AppError(error.message, "CREATE_EVENT_FAILED");
    }
  }

  async createJob(input: CreateJobInput) {
    const session = await getSessionOrThrow();
    const client: any = getBrowserSupabaseClient();
    const { data: event, error: eventError } = await client
      .from("events")
      .select("organization_id")
      .eq("id", input.eventId)
      .single();

    if (eventError || !event) {
      throw new AppError("Event not found.", "EVENT_NOT_FOUND", 404);
    }

    const { error } = await client.from("jobs").insert({
      event_id: input.eventId,
      organization_id: event.organization_id,
      created_by: session.user.id,
      title: input.title,
      description: input.description,
      role_type: input.roleType,
      shift_start: input.shiftStart,
      shift_end: input.shiftEnd,
      pay_rate: input.payRate,
      positions_needed: input.positionsNeeded,
      minimum_age: input.minimumAge ?? null,
      status: "open"
    });

    if (error) {
      throw new AppError(error.message, "CREATE_JOB_FAILED");
    }
  }

  async updateJobStatus(jobId: string, status: Extract<JobStatus, "open" | "closed" | "cancelled">) {
    const client: any = getBrowserSupabaseClient();
    const { error } = await client
      .from("jobs")
      .update({ status })
      .eq("id", jobId);

    if (error) {
      throw new AppError(error.message, "UPDATE_JOB_FAILED");
    }
  }

  async applyToJob(input: JobApplicationInput) {
    const session = await getSessionOrThrow();
    const client: any = getBrowserSupabaseClient();
    const { error } = await client.from("applications").insert({
      job_id: input.jobId,
      staff_id: session.user.id,
      status: "pending",
      cover_note: input.coverNote
    });

    if (error) {
      throw new AppError(error.message, "APPLY_FAILED");
    }
  }

  async withdrawApplication(applicationId: string) {
    const client: any = getBrowserSupabaseClient();
    const { error } = await client
      .from("applications")
      .update({ status: "withdrawn" })
      .eq("id", applicationId);

    if (error) {
      throw new AppError(error.message, "WITHDRAW_APPLICATION_FAILED");
    }
  }

  async saveJob(jobId: string) {
    const session = await this.getSession();

    if (!session || session.role !== "staff") {
      throw new AppError("You must be signed in as staff.", "UNAUTHENTICATED", 401);
    }

    const client: any = getBrowserSupabaseClient();
    const { error } = await client
      .from("saved_jobs")
      .upsert(
        {
          staff_id: session.userId,
          job_id: jobId
        },
        { onConflict: "staff_id,job_id" }
      );

    if (error) {
      throw new AppError(error.message, "SAVE_JOB_FAILED");
    }
  }

  async unsaveJob(jobId: string) {
    const session = await this.getSession();

    if (!session || session.role !== "staff") {
      throw new AppError("You must be signed in as staff.", "UNAUTHENTICATED", 401);
    }

    const client: any = getBrowserSupabaseClient();
    const { error } = await client
      .from("saved_jobs")
      .delete()
      .eq("staff_id", session.userId)
      .eq("job_id", jobId);

    if (error) {
      throw new AppError(error.message, "UNSAVE_JOB_FAILED");
    }
  }

  async upsertJobAlert(input: JobAlertInput): Promise<JobAlert> {
    const session = await this.getSession();

    if (!session || session.role !== "staff") {
      throw new AppError("You must be signed in as staff.", "UNAUTHENTICATED", 401);
    }

    const client: any = getBrowserSupabaseClient();
    const payload = {
      id: input.id,
      staff_id: session.userId,
      name: input.name,
      query: input.query || null,
      location: input.location || null,
      role_types: input.roleTypes ?? [],
      minimum_pay: input.minimumPay ?? null,
      date_from: input.dateFrom || null,
      date_to: input.dateTo || null,
      is_active: input.isActive,
      email_opt_in: input.emailOptIn
    };
    const { data, error } = await client
      .from("job_alerts")
      .upsert(payload)
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(error?.message ?? "Unable to save job alert.", "SAVE_JOB_ALERT_FAILED");
    }

    return mapJobAlert(data);
  }

  async deleteJobAlert(alertId: string) {
    const session = await this.getSession();

    if (!session || session.role !== "staff") {
      throw new AppError("You must be signed in as staff.", "UNAUTHENTICATED", 401);
    }

    const client: any = getBrowserSupabaseClient();
    const { error } = await client
      .from("job_alerts")
      .delete()
      .eq("staff_id", session.userId)
      .eq("id", alertId);

    if (error) {
      throw new AppError(error.message, "DELETE_JOB_ALERT_FAILED");
    }
  }

  async recordJobView(jobId: string) {
    const session = await this.getSession();

    if (!session || session.role !== "staff") {
      return;
    }

    const client: any = getBrowserSupabaseClient();
    const threshold = new Date(Date.now() - JOB_VIEW_DEDUPLICATION_WINDOW_MS).toISOString();
    const [jobResult, existingResult] = await Promise.all([
      client.from("jobs").select("id, status").eq("id", jobId).maybeSingle(),
      client
        .from("job_view_events")
        .select("id")
        .eq("job_id", jobId)
        .eq("viewer_id", session.userId)
        .gte("viewed_at", threshold)
        .limit(1)
    ]);

    if (jobResult.error || existingResult.error) {
      throw new AppError(
        jobResult.error?.message ??
          existingResult.error?.message ??
          "Unable to record job view.",
        "SUPABASE_QUERY"
      );
    }

    if (!jobResult.data || jobResult.data.status !== "open" || (existingResult.data ?? []).length > 0) {
      return;
    }

    const { error } = await client.from("job_view_events").insert({
      job_id: jobId,
      viewer_id: session.userId
    });

    if (error) {
      throw new AppError(error.message, "SUPABASE_QUERY");
    }
  }

  async updateApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<{ warning?: string }> {
    const response = await fetch(`/api/applications/${applicationId}/status`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      throw new AppError("Unable to update application status.", "UPDATE_APPLICATION_FAILED");
    }

    const payload = (await response.json()) as { warning?: string };
    return payload;
  }

  async markEventCompleted(eventId: string) {
    const client: any = getBrowserSupabaseClient();
    const { error } = await client.from("events").update({ status: "completed" }).eq("id", eventId);

    if (error) {
      throw new AppError(error.message, "UPDATE_EVENT_FAILED");
    }
  }

  async submitOperatorReview(input: OperatorReviewInput): Promise<Rating> {
    const session = await getSessionOrThrow();
    const client: any = getBrowserSupabaseClient();
    const organizationLookup = await client
      .from("jobs")
      .select("organization_id")
      .eq("id", input.jobId)
      .single();
    const overallScore =
      (input.reliabilityScore +
        input.professionalismScore +
        input.communicationScore +
        input.customerServiceScore +
        input.pressureHandlingScore) /
      5;
    const { data, error } = await client
      .from("ratings")
      .insert({
        event_id: input.eventId,
        job_id: input.jobId,
        organization_id: organizationLookup.data?.organization_id,
        staff_id: input.staffId,
        organiser_id: session.user.id,
        reliability_score: input.reliabilityScore,
        professionalism_score: input.professionalismScore,
        communication_score: input.communicationScore,
        customer_service_score: input.customerServiceScore,
        pressure_handling_score: input.pressureHandlingScore,
        overall_score: overallScore,
        comment: input.comment
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(error?.message ?? "Unable to submit review.", "RATING_FAILED");
    }

    return mapRating(data);
  }

  async submitClientFeedback(input: ClientFeedbackInput) {
    const session = await getSessionOrThrow();
    const client: any = getBrowserSupabaseClient();
    const { error } = await client.from("client_feedback").insert({
      assignment_id: input.assignmentId,
      job_id: input.jobId,
      organization_id: input.clientId,
      staff_id: session.user.id,
      client_id: input.clientId,
      sentiment: input.sentiment,
      reasons: input.reasons,
      note: input.note || null
    });

    if (error) {
      throw new AppError(error.message, "CLIENT_FEEDBACK_FAILED");
    }
  }

  async updateOperatorProfile(input: UpdateOperatorProfileInput) {
    const session = await getSessionOrThrow();
    const client: any = getBrowserSupabaseClient();
    const age = Math.max(0, new Date().getFullYear() - new Date(input.dateOfBirth).getFullYear());

    const [profileResult, operatorProfileResult] = await Promise.all([
      client
        .from("profiles")
        .update({
          full_name: input.fullName,
          phone: input.phone,
          bio: input.details,
          skills: input.skills,
          availability: input.headline || null,
          avatar_url: input.avatarUrl || null,
          location: input.baseLocation,
          languages: input.languages,
          preferred_roles: input.preferredRoles,
          age,
          updated_at: new Date().toISOString()
        })
        .eq("id", session.user.id),
      client
        .from("operator_profiles")
        .upsert({
          profile_id: session.user.id,
          display_name: input.fullName,
          headline: input.headline || null,
          base_location: input.baseLocation,
          details: input.details,
          preferred_roles: input.preferredRoles,
          languages: input.languages,
          date_of_birth: input.dateOfBirth,
          age,
          avatar_url: input.avatarUrl || null,
          updated_at: new Date().toISOString()
        })
    ]);

    if (profileResult.error || operatorProfileResult.error) {
      throw new AppError(
        profileResult.error?.message ??
          operatorProfileResult.error?.message ??
          "Unable to update operator profile.",
        "PROFILE_UPDATE_FAILED"
      );
    }
  }

  async updateOperatorAvailability(input: UpdateOperatorAvailabilityInput) {
    const session = await getSessionOrThrow();
    const client: any = getBrowserSupabaseClient();

    const [profileResult, operatorProfileResult, deleteResult] = await Promise.all([
      client
        .from("profiles")
        .update({
          availability: input.availabilitySummary,
          updated_at: new Date().toISOString()
        })
        .eq("id", session.user.id),
      client
        .from("operator_profiles")
        .upsert({
          profile_id: session.user.id,
          availability_summary: input.availabilitySummary,
          updated_at: new Date().toISOString()
        }),
      client.from("operator_availability_rules").delete().eq("operator_id", session.user.id)
    ]);

    if (profileResult.error || operatorProfileResult.error || deleteResult.error) {
      throw new AppError("Unable to reset operator availability.", "AVAILABILITY_UPDATE_FAILED");
    }

    const { error } = await client.from("operator_availability_rules").insert(
      input.rules.map((rule) => ({
        id: rule.id ?? crypto.randomUUID(),
        operator_id: session.user.id,
        day_of_week: rule.dayOfWeek,
        is_available: rule.isAvailable,
        is_all_day: rule.isAllDay,
        start_time: rule.startTime || null,
        end_time: rule.endTime || null
      }))
    );

    if (error) {
      throw new AppError(error.message, "AVAILABILITY_UPDATE_FAILED");
    }
  }

  async updateEmail(input: UpdateEmailInput) {
    const session = await getSessionOrThrow();
    const client: any = getBrowserSupabaseClient();
    const now = new Date().toISOString();
    const { error: authError } = await client.auth.updateUser({ email: input.email });
    const { error: profileError } = await client
      .from("profiles")
      .update({ email: input.email, updated_at: now })
      .eq("id", session.user.id);
    const { error: marketingError } = await client
      .from("marketing_preferences")
      .update({ email_normalized: normalizeEmail(input.email), updated_at: now })
      .eq("profile_id", session.user.id);

    if (authError || profileError || marketingError) {
      throw new AppError(
        authError?.message ?? profileError?.message ?? marketingError?.message ?? "Unable to update email.",
        "EMAIL_UPDATE_FAILED"
      );
    }
  }

  async updateMarketingPreferences(input: UpdateMarketingPreferencesInput) {
    const response = await fetch("/api/marketing/preferences", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new AppError("Unable to update email preferences.", "MARKETING_PREFERENCES_UPDATE_FAILED");
    }
  }

  async updatePassword(input: UpdatePasswordInput) {
    const client: any = getBrowserSupabaseClient();
    const { error } = await client.auth.updateUser({ password: input.password });

    if (error) {
      throw new AppError(error.message, "PASSWORD_UPDATE_FAILED");
    }

    await fetch("/api/auth/password-changed", {
      method: "POST",
      credentials: "include"
    });
  }
}
