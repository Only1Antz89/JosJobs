import { createServiceRoleClient } from "@/lib/data/supabase-client";
import { buildBaseDemoDatabase } from "@/lib/data/demo-seed";
import { buildRankedStaff } from "@/lib/domain/ranking";
import { env, getRuntimeMode } from "@/lib/env";
import type { EnrichedJob, LandingHighlights, Profile, RankedStaffRow, Rating } from "@/types/domain";

// Public pages are rendered on the server with the service-role client, and anything
// returned here is sent to the browser. Never include contact details.
function mapPublicStaffProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    role: "staff",
    fullName: String(row.full_name),
    email: "",
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

function mapPublicRating(row: Record<string, unknown>): Rating {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    jobId: String(row.job_id ?? ""),
    organizationId: String(row.organization_id),
    staffId: String(row.staff_id),
    organiserId: String(row.organiser_id),
    reliabilityScore: Number(row.reliability_score ?? row.rating ?? 0),
    professionalismScore: Number(row.professionalism_score ?? row.rating ?? 0),
    communicationScore: Number(row.communication_score ?? row.rating ?? 0),
    customerServiceScore: Number(row.customer_service_score ?? row.rating ?? 0),
    pressureHandlingScore: Number(row.pressure_handling_score ?? row.rating ?? 0),
    overallScore: Number(row.overall_score ?? row.rating ?? 0),
    rating: Number(row.overall_score ?? row.rating ?? 0),
    comment: String(row.comment ?? ""),
    createdAt: String(row.created_at)
  };
}

function reportPublicQueryFailure(scope: string, error: unknown) {
  console.error(`[athena] public ${scope} query failed`, error);
}

const EMPTY_HIGHLIGHTS: LandingHighlights = {
  featuredJobs: [],
  topStaff: [],
  stats: { activeJobs: 0, organisers: 0, staff: 0, placements: 0 }
};

// Sample data is only for environments without Supabase. A live site must never show
// sample jobs or people, so live failures return empty results and log instead.
function shouldUseDemoData() {
  return getRuntimeMode() === "demo";
}

function getLiveServiceClient(scope: string) {
  if (!env.supabaseServiceRoleKey) {
    reportPublicQueryFailure(scope, new Error("SUPABASE_SERVICE_ROLE_KEY is not set."));
    return null;
  }

  return createServiceRoleClient();
}

function buildPublicDemoJobs(): EnrichedJob[] {
  const database = buildBaseDemoDatabase();

  return database.jobs
    .filter((job) => job.status === "open")
    .map((job) => {
      const event = database.events.find((item) => item.id === job.eventId)!;
      const organization = database.organizations.find((item) => item.id === job.organizationId)!;

      return {
        ...job,
        event,
        organization,
        applicationCount: database.applications.filter((item) => item.jobId === job.id).length
      };
    });
}

function buildPublicDemoHighlights(): LandingHighlights {
  const database = buildBaseDemoDatabase();
  return {
    featuredJobs: buildPublicDemoJobs().slice(0, 4),
    topStaff: buildRankedStaff(
      database.profiles.filter((profile) => profile.role === "staff"),
      database.ratings
    ).slice(0, 4),
    stats: {
      activeJobs: database.jobs.filter((job) => job.status === "open").length,
      organisers: database.profiles.filter((profile) => profile.role === "organiser").length,
      staff: database.profiles.filter((profile) => profile.role === "staff").length,
      placements: database.applications.filter((application) => application.status === "accepted").length
    }
  };
}

function mapPublicJob(row: Record<string, unknown>): EnrichedJob {
  const eventRow = row.events as Record<string, unknown>;
  const organizationRow = row.organizations as Record<string, unknown>;

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
    minimumAge:
      row.minimum_age === null || row.minimum_age === undefined ? null : Number(row.minimum_age),
    status: row.status as EnrichedJob["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    event: {
      id: String(eventRow.id),
      organizationId: String(eventRow.organization_id),
      createdBy: String(eventRow.created_by),
      title: String(eventRow.title),
      description: String(eventRow.description ?? ""),
      location: String(eventRow.location ?? ""),
      eventDate: String(eventRow.event_date),
      eventType: String(eventRow.event_type ?? ""),
      requiredRoles: Array.isArray(eventRow.required_roles) ? eventRow.required_roles.map(String) : [],
      serviceTier: (eventRow.service_tier ?? "mixed") as EnrichedJob["event"]["serviceTier"],
      serviceTierSource: (eventRow.service_tier_source ?? "default") as EnrichedJob["event"]["serviceTierSource"],
      suggestedServiceTier: eventRow.suggested_service_tier
        ? (String(eventRow.suggested_service_tier) as EnrichedJob["event"]["serviceTier"])
        : undefined,
      aiSuggestedTags: Array.isArray(eventRow.ai_suggested_tags) ? eventRow.ai_suggested_tags.map(String) : [],
      aiSuggestedRoles: Array.isArray(eventRow.ai_suggested_roles) ? eventRow.ai_suggested_roles.map(String) : [],
      status: eventRow.status as EnrichedJob["event"]["status"],
      createdAt: String(eventRow.created_at),
      updatedAt: String(eventRow.updated_at)
    },
    organization: {
      id: String(organizationRow.id),
      name: String(organizationRow.name),
      slug: String(organizationRow.slug),
      createdAt: String(organizationRow.created_at)
    },
    applicationCount: Array.isArray(row.applications) ? row.applications.length : 0
  };
}

export async function getPublicHighlights(): Promise<LandingHighlights> {
  if (shouldUseDemoData()) {
    return buildPublicDemoHighlights();
  }

  const client = getLiveServiceClient("highlights");

  if (!client) {
    return EMPTY_HIGHLIGHTS;
  }

  const [
    jobsResult,
    profilesResult,
    ratingsResult,
    organiserCountResult,
    staffCountResult,
    placementsResult,
    openJobsCountResult
  ] = await Promise.all([
    client
      .from("jobs")
      .select("*, events(*), organizations(*), applications(id)")
      .eq("status", "open")
      .limit(4),
    client.from("profiles").select("*").eq("role", "staff"),
    client.from("ratings").select("*"),
    client.from("profiles").select("id", { count: "exact", head: true }).eq("role", "organiser"),
    client.from("profiles").select("id", { count: "exact", head: true }).eq("role", "staff"),
    client
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted"),
    client.from("jobs").select("id", { count: "exact", head: true }).eq("status", "open")
  ]);

  if (
    jobsResult.error ||
    profilesResult.error ||
    ratingsResult.error ||
    organiserCountResult.error ||
    staffCountResult.error ||
    placementsResult.error ||
    openJobsCountResult.error
  ) {
    reportPublicQueryFailure(
      "highlights",
      jobsResult.error ??
        profilesResult.error ??
        ratingsResult.error ??
        organiserCountResult.error ??
        staffCountResult.error ??
        placementsResult.error ??
        openJobsCountResult.error
    );
    return EMPTY_HIGHLIGHTS;
  }

  return {
    featuredJobs: (jobsResult.data ?? []).map((row) => mapPublicJob(row)),
    topStaff: buildRankedStaff(
      (profilesResult.data ?? []).map((row) => mapPublicStaffProfile(row)),
      (ratingsResult.data ?? []).map((row) => mapPublicRating(row))
    ).slice(0, 4),
    stats: {
      activeJobs: openJobsCountResult.count ?? 0,
      organisers: organiserCountResult.count ?? 0,
      staff: staffCountResult.count ?? 0,
      placements: placementsResult.count ?? 0
    }
  };
}

export async function getPublicJobs() {
  if (shouldUseDemoData()) {
    return buildPublicDemoJobs();
  }

  const client = getLiveServiceClient("jobs");

  if (!client) {
    return [];
  }

  const jobsResult = await client
    .from("jobs")
    .select("*, events(*), organizations(*), applications(id)")
    .eq("status", "open");

  if (jobsResult.error) {
    reportPublicQueryFailure("jobs", jobsResult.error);
    return [];
  }

  return (jobsResult.data ?? []).map((row) => mapPublicJob(row));
}

export async function getPublicRankedStaff(): Promise<RankedStaffRow[]> {
  if (shouldUseDemoData()) {
    const database = buildBaseDemoDatabase();
    return buildRankedStaff(
      database.profiles.filter((profile) => profile.role === "staff"),
      database.ratings
    );
  }

  const client = getLiveServiceClient("staff");

  if (!client) {
    return [];
  }

  const [profilesResult, ratingsResult] = await Promise.all([
    client.from("profiles").select("*").eq("role", "staff"),
    client.from("ratings").select("*")
  ]);

  if (profilesResult.error || ratingsResult.error) {
    reportPublicQueryFailure("staff", profilesResult.error ?? ratingsResult.error);
    return [];
  }

  return buildRankedStaff(
    (profilesResult.data ?? []).map((row) => mapPublicStaffProfile(row)),
    (ratingsResult.data ?? []).map((row) => mapPublicRating(row))
  );
}
