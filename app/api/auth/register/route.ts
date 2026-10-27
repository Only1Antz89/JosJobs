import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMarketingPreferenceUpsert } from "@/lib/email/marketing";
import { AppError } from "@/lib/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { organiserSignupSchema, staffSignupSchema } from "@/lib/validation/schemas";

const registrationSchema = z.union([organiserSignupSchema, staffSignupSchema]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function createUniqueOrganizationSlug(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  companyName: string
) {
  const baseSlug = slugify(companyName) || "company";

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new AppError(error.message, "ORGANIZATION_SLUG_CHECK_FAILED", 500);
    }

    if (!data) {
      return candidate;
    }
  }

  return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
}

function buildStaffAvailabilityRules(userId: string, input: z.infer<typeof staffSignupSchema>) {
  if (input.availabilityRules) {
    return input.availabilityRules.map((rule) => ({
      id: crypto.randomUUID(),
      operator_id: userId,
      day_of_week: rule.dayOfWeek,
      is_available: rule.isAvailable,
      is_all_day: rule.isAllDay,
      start_time: rule.startTime || null,
      end_time: rule.endTime || null
    }));
  }

  return Array.from({ length: 7 }).map((_, dayOfWeek) => ({
    id: crypto.randomUUID(),
    operator_id: userId,
    day_of_week: dayOfWeek,
    is_available: false,
    is_all_day: false,
    start_time: null,
    end_time: null
  }));
}

function registrationErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ ok: false, error: error.issues[0]?.message ?? "Please check the form and try again." }, { status: 400 });
  }

  // Problems the person can fix (for example an email already in use) are shown as written.
  if (error instanceof AppError && error.status < 500) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }

  // Anything else is a server or database problem: log the detail, show a plain message.
  console.error("[athena] registration failed", error);
  return NextResponse.json(
    {
      ok: false,
      error: "We couldn't create your account just now. Please try again in a few minutes, or contact us if it keeps happening."
    },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  let createdOrganizationId: string | null = null;

  try {
    const supabase = createAdminSupabaseClient();
    const payload = registrationSchema.parse(await request.json());
    const now = new Date().toISOString();

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName,
        role: payload.role
      }
    });

    if (userError || !userData.user) {
      const message = userError?.message?.toLowerCase().includes("already")
        ? "This email is already registered. Sign in instead."
        : userError?.message ?? "Unable to create account.";
      throw new AppError(message, "AUTH_USER_CREATE_FAILED", userError?.status ?? 400);
    }

    createdUserId = userData.user.id;

    if (payload.role === "organiser") {
      createdOrganizationId = crypto.randomUUID();
      const slug = await createUniqueOrganizationSlug(supabase, payload.companyName);

      const [organizationResult, profileResult] = await Promise.all([
        supabase.from("organizations").insert({
          id: createdOrganizationId,
          name: payload.companyName,
          slug,
          created_at: now
        }),
        supabase.from("profiles").insert({
          id: createdUserId,
          role: "organiser",
          full_name: payload.fullName,
          email: payload.email,
          company_name: payload.companyName,
          skills: [],
          created_at: now,
          updated_at: now
        })
      ]);

      if (organizationResult.error || profileResult.error) {
        throw new AppError(
          organizationResult.error?.message ?? profileResult.error?.message ?? "Unable to create company workspace.",
          "ORGANISER_PROFILE_CREATE_FAILED",
          500
        );
      }

      const [membershipResult, marketingResult] = await Promise.all([
        supabase.from("organization_memberships").insert({
          id: crypto.randomUUID(),
          organization_id: createdOrganizationId,
          profile_id: createdUserId,
          role: "owner",
          created_at: now
        }),
        supabase.from("marketing_preferences").insert({
          ...buildMarketingPreferenceUpsert({
            profileId: createdUserId,
            email: payload.email,
            source: "signup_organiser",
            consent: {
              newsletterConsent: payload.newsletterConsent,
              offersConsent: payload.newsletterConsent,
              productUpdatesConsent: payload.newsletterConsent
            },
            now
          })
        })
      ]);

      if (membershipResult.error || marketingResult.error) {
        throw new AppError(
          membershipResult.error?.message ?? marketingResult.error?.message ?? "Unable to finish company workspace.",
          "ORGANISER_WORKSPACE_CREATE_FAILED",
          500
        );
      }
    } else {
      const skills = payload.skills.split(",").map((item) => item.trim()).filter(Boolean);
      const preferredRoles = skills.slice(0, 2);

      const profileResult = await supabase.from("profiles").insert({
        id: createdUserId,
        role: "staff",
        full_name: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        bio: payload.bio,
        skills,
        availability: payload.availability,
        location: payload.location,
        created_at: now,
        updated_at: now
      });

      if (profileResult.error) {
        throw new AppError(
          profileResult.error.message ?? "Unable to create field-team profile.",
          "STAFF_PROFILE_CREATE_FAILED",
          500
        );
      }

      const [operatorProfileResult, paymentResult, marketingResult, availabilityResult] = await Promise.all([
        supabase.from("operator_profiles").insert({
          profile_id: createdUserId,
          display_name: payload.fullName,
          base_location: payload.location,
          details: payload.bio,
          preferred_roles: preferredRoles,
          languages: ["English"],
          can_drive: payload.canDrive,
          availability_summary: payload.availability,
          created_at: now,
          updated_at: now
        }),
        supabase.from("operator_payment_profiles").insert({
          operator_id: createdUserId,
          provider: "stripe",
          onboarding_status: "not_started",
          payouts_enabled: false,
          details_submitted: false,
          updated_at: now
        }),
        supabase.from("marketing_preferences").insert({
          ...buildMarketingPreferenceUpsert({
            profileId: createdUserId,
            email: payload.email,
            source: "signup_staff",
            consent: {
              newsletterConsent: payload.newsletterConsent,
              offersConsent: payload.newsletterConsent,
              productUpdatesConsent: payload.newsletterConsent
            },
            now
          })
        }),
        supabase.from("operator_availability_rules").insert(buildStaffAvailabilityRules(createdUserId, payload))
      ]);

      if (
        operatorProfileResult.error ||
        paymentResult.error ||
        marketingResult.error ||
        availabilityResult.error
      ) {
        throw new AppError(
          operatorProfileResult.error?.message ??
            paymentResult.error?.message ??
            marketingResult.error?.message ??
            availabilityResult.error?.message ??
            "Unable to create field-team profile.",
          "STAFF_PROFILE_CREATE_FAILED",
          500
        );
      }
    }

    return NextResponse.json({
      ok: true,
      userId: createdUserId,
      role: payload.role,
      email: payload.email
    });
  } catch (error) {
    if (createdUserId || createdOrganizationId) {
      const supabase = createAdminSupabaseClient();

      if (createdUserId) {
        await supabase.auth.admin.deleteUser(createdUserId);
      }

      if (createdOrganizationId) {
        await supabase.from("organizations").delete().eq("id", createdOrganizationId);
      }
    }

    return registrationErrorResponse(error);
  }
}
