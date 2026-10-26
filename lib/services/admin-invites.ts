import { z } from "zod";
import { buildMarketingPreferenceUpsert } from "@/lib/email/marketing";
import { markdownToHtml } from "@/lib/email/content";
import { AppError } from "@/lib/errors";
import { sendTransactionalTemplateEmail } from "@/lib/services/admin-communications";
import { ensureClientRow, ensureOperatorRow, writeAuditLog } from "@/lib/services/admin-mutations";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Lets an admin add a client or operator who hasn't signed up yet. We create the
// account with the same rows the public sign-up creates, then email a one-time
// link so the person sets their own password. Nobody ever sees a password.

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

const optionalText = z.string().trim().max(200).optional();

export const inviteClientSchema = z.object({
  companyName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email(),
  phone: optionalText,
  notes: z.string().max(5000).optional()
});

export const inviteOperatorSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email(),
  phone: optionalText,
  location: optionalText,
  skillTags: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  notes: z.string().max(5000).optional()
});

export type InviteClientInput = z.infer<typeof inviteClientSchema>;
export type InviteOperatorInput = z.infer<typeof inviteOperatorSchema>;

function fail(message: string, error?: { message: string } | null, status = 500): never {
  throw new AppError(error ? `${message}: ${error.message}` : message, "ADMIN_INVITE_FAILED", status);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueOrganizationSlug(client: AdminClient, companyName: string) {
  const base = slugify(companyName) || "company";

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data, error } = await client.from("organizations").select("id").eq("slug", candidate).maybeSingle();
    if (error) fail("Could not check company name", error);
    if (!data) return candidate;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function createAuthUser(client: AdminClient, email: string, fullName: string, role: "organiser" | "staff") {
  const { data, error } = await client.auth.admin.createUser({
    email,
    // Random throwaway password; the person sets their own from the invite link.
    password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, invited_by_admin: true }
  });

  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("already")) {
      fail("Someone with this email already has an account.", null, 409);
    }
    fail("Could not create the account", error);
  }

  return data.user.id;
}

function noMarketingConsent(profileId: string, email: string, now: string) {
  return buildMarketingPreferenceUpsert({
    profileId,
    email,
    source: "admin_invite",
    consent: { newsletterConsent: false, offersConsent: false, productUpdatesConsent: false },
    now
  });
}

async function sendInviteEmail(input: {
  client: AdminClient;
  email: string;
  name: string;
  profileId: string;
  kind: "client" | "operator";
  origin: string;
}) {
  try {
    const { data, error } = await input.client.auth.admin.generateLink({
      type: "recovery",
      email: input.email,
      options: { redirectTo: `${input.origin}/auth/reset-password` }
    });

    if (error || !data.properties?.action_link) {
      throw new Error(error?.message ?? "No link returned.");
    }

    const bodyMarkdown =
      input.kind === "client"
        ? `# Your Athena Pro account is ready
The Athena Pro team has set up an account for you so you can post events and book staff.

- Use the button below to choose your password
- The link works once and expires after a short time
- If it has expired, use "Forgot password" on the sign-in page`
        : `# Your Athena Pro operator account is ready
The Athena Pro team has set up an operator account for you so you can apply for work.

- Use the button below to choose your password
- Then complete your profile so clients can book you
- If the link has expired, use "Forgot password" on the sign-in page`;

    await sendTransactionalTemplateEmail({
      templateType: input.kind === "client" ? "client_onboarding" : "operator_onboarding",
      to: input.email,
      profileId: input.profileId,
      recipientName: input.name,
      bodyMarkdown,
      bodyHtml: markdownToHtml(bodyMarkdown),
      ctaLabel: "Set your password",
      ctaUrl: data.properties.action_link,
      metadata: { source: "admin_invite" }
    });

    return undefined;
  } catch (error) {
    console.error("[athena] invite email failed", error);
    return `The account was created, but the invite email didn't send. Ask ${input.email} to use "Forgot password" on the sign-in page.`;
  }
}

async function cleanUp(client: AdminClient, userId: string | null, organizationId: string | null) {
  if (organizationId) {
    await client.from("organizations").delete().eq("id", organizationId);
  }
  if (userId) {
    await client.auth.admin.deleteUser(userId);
  }
}

export async function inviteClient(actorId: string, input: InviteClientInput, origin: string) {
  const client = createAdminSupabaseClient();
  const now = new Date().toISOString();
  let userId: string | null = null;
  let organizationId: string | null = null;

  try {
    userId = await createAuthUser(client, input.email, input.contactName, "organiser");
    organizationId = crypto.randomUUID();
    const slug = await uniqueOrganizationSlug(client, input.companyName);

    const organization = await client
      .from("organizations")
      .insert({ id: organizationId, name: input.companyName, slug, created_at: now });
    if (organization.error) fail("Could not create the company", organization.error);

    const profile = await client.from("profiles").insert({
      id: userId,
      role: "organiser",
      full_name: input.contactName,
      email: input.email,
      phone: input.phone || null,
      company_name: input.companyName,
      skills: [],
      created_at: now,
      updated_at: now
    });
    if (profile.error) fail("Could not create the profile", profile.error);

    const [membership, marketing] = await Promise.all([
      client.from("organization_memberships").insert({
        id: crypto.randomUUID(),
        organization_id: organizationId,
        profile_id: userId,
        role: "owner",
        created_at: now
      }),
      client.from("marketing_preferences").insert(noMarketingConsent(userId, input.email, now))
    ]);
    if (membership.error) fail("Could not link the contact to the company", membership.error);
    if (marketing.error) fail("Could not save email preferences", marketing.error);

    const clientRow = await ensureClientRow(client, organizationId);
    if (input.notes?.trim()) {
      await client.from("clients").update({ notes: input.notes.trim() }).eq("id", clientRow.id as string);
    }
  } catch (error) {
    await cleanUp(client, userId, organizationId);
    throw error;
  }

  await writeAuditLog(client, {
    actorId,
    entityType: "client",
    entityId: organizationId,
    action: "client.invited",
    label: "Client invited",
    summary: `${input.companyName} added by an admin and invited at ${input.email}.`
  });

  const warning = await sendInviteEmail({
    client,
    email: input.email,
    name: input.contactName,
    profileId: userId,
    kind: "client",
    origin
  });

  return { id: organizationId, warning };
}

export async function inviteOperator(actorId: string, input: InviteOperatorInput, origin: string) {
  const client = createAdminSupabaseClient();
  const now = new Date().toISOString();
  let userId: string | null = null;

  try {
    userId = await createAuthUser(client, input.email, input.fullName, "staff");
    const staffId = userId;

    const profile = await client.from("profiles").insert({
      id: staffId,
      role: "staff",
      full_name: input.fullName,
      email: input.email,
      phone: input.phone || null,
      location: input.location || null,
      skills: input.skillTags,
      created_at: now,
      updated_at: now
    });
    if (profile.error) fail("Could not create the profile", profile.error);

    const results = await Promise.all([
      client.from("operator_profiles").insert({
        profile_id: staffId,
        display_name: input.fullName,
        base_location: input.location || null,
        preferred_roles: input.skillTags.slice(0, 2),
        languages: ["English"],
        created_at: now,
        updated_at: now
      }),
      client.from("operator_payment_profiles").insert({
        operator_id: staffId,
        provider: "stripe",
        onboarding_status: "not_started",
        payouts_enabled: false,
        details_submitted: false,
        updated_at: now
      }),
      client.from("marketing_preferences").insert(noMarketingConsent(staffId, input.email, now)),
      client.from("operator_availability_rules").insert(
        Array.from({ length: 7 }).map((_, dayOfWeek) => ({
          id: crypto.randomUUID(),
          operator_id: staffId,
          day_of_week: dayOfWeek,
          is_available: false,
          is_all_day: false,
          start_time: null,
          end_time: null
        }))
      )
    ]);
    const failed = results.find((result) => result.error);
    if (failed?.error) fail("Could not finish the operator profile", failed.error);

    const operatorRow = await ensureOperatorRow(client, staffId);
    if (input.notes?.trim()) {
      await client.from("operators").update({ notes: input.notes.trim() }).eq("id", operatorRow.id as string);
    }
  } catch (error) {
    await cleanUp(client, userId, null);
    throw error;
  }

  await writeAuditLog(client, {
    actorId,
    entityType: "operator",
    entityId: userId,
    action: "operator.invited",
    label: "Operator invited",
    summary: `${input.fullName} added by an admin and invited at ${input.email}.`
  });

  const warning = await sendInviteEmail({
    client,
    email: input.email,
    name: input.fullName,
    profileId: userId,
    kind: "operator",
    origin
  });

  return { id: userId, warning };
}
