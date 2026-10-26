import { z } from "zod";
import { AppError } from "@/lib/errors";
import { sendOnboardingApprovedEmail } from "@/lib/services/admin-communications";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Writes made from the admin portal. Every write goes through the service-role
// client (admins are checked by requireAdmin() in the route first) and leaves an
// audit_logs entry so the portal's audit trail shows who changed what.

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;
type Row = Record<string, unknown>;

const onboardingStatus = z.enum(["pending", "in_review", "approved", "rejected"]);
const optionalText = z.string().trim().max(500).optional();
const optionalEmail = z.union([z.string().trim().email(), z.literal("")]).optional();

export const updateClientSchema = z.object({
  companyName: z.string().trim().min(2).max(200).optional(),
  tradingName: optionalText,
  primaryContactName: optionalText,
  primaryContactEmail: optionalEmail,
  primaryContactPhone: optionalText,
  billingContactName: optionalText,
  billingContactEmail: optionalEmail,
  billingContactPhone: optionalText,
  addressLine1: optionalText,
  addressLine2: optionalText,
  city: optionalText,
  region: optionalText,
  postcode: optionalText,
  country: optionalText,
  vatNumber: optionalText,
  status: z.enum(["active", "inactive", "at_risk"]).optional(),
  onboardingStatus: onboardingStatus.optional(),
  notes: z.string().max(5000).optional()
});

export const updateOperatorSchema = z.object({
  displayName: z.string().trim().min(2).max(200).optional(),
  regions: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  skillTags: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  verificationStatus: z.enum(["pending", "in_review", "verified", "rejected"]).optional(),
  onboardingStatus: onboardingStatus.optional(),
  isActive: z.boolean().optional(),
  totalCancellations: z.number().int().min(0).max(1000).optional(),
  totalNoShows: z.number().int().min(0).max(1000).optional(),
  notes: z.string().max(5000).optional()
});

export const operatorPreferenceSchema = z.object({
  operatorId: z.string().uuid(),
  preference: z.enum(["favourite", "blocked"]),
  enabled: z.boolean(),
  reason: z.string().trim().max(500).optional()
});

export const updateAssignmentSchema = z.object({
  chargeRate: z.number().min(0).max(10000).nullable().optional(),
  status: z.enum(["open", "closed", "cancelled"]).optional()
});

export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type UpdateOperatorInput = z.infer<typeof updateOperatorSchema>;
export type OperatorPreferenceInput = z.infer<typeof operatorPreferenceSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

function fail(message: string, error?: { message: string } | null, status = 500): never {
  throw new AppError(error ? `${message}: ${error.message}` : message, "ADMIN_WRITE_FAILED", status);
}

function emptyToNull(value: string | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function dropUndefined<T extends Row>(row: T): Partial<T> {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export async function writeAuditLog(
  client: AdminClient,
  entry: {
    // null for system actions such as the Stripe webhook.
    actorId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    label: string;
    summary?: string;
    before?: unknown;
    after?: unknown;
  }
) {
  const { error } = await client.from("audit_logs").insert({
    actor_profile_id: entry.actorId || null,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    action: entry.action,
    before_state: entry.before ?? null,
    after_state: entry.after ?? null,
    metadata: { label: entry.label, summary: entry.summary ?? "" }
  });

  // The change itself already succeeded; a missing audit row is logged, not fatal.
  if (error) {
    console.error("[athena] audit log write failed", error);
  }
}

// Returns the public.clients row for an organisation, creating it on first use.
export async function ensureClientRow(client: AdminClient, organizationId: string): Promise<Row> {
  const existing = await client.from("clients").select("*").eq("organization_id", organizationId).maybeSingle();

  if (existing.error) fail("Could not read client details", existing.error);
  if (existing.data) return existing.data as Row;

  const organization = await client.from("organizations").select("id, name").eq("id", organizationId).maybeSingle();
  if (organization.error) fail("Could not read organisation", organization.error);
  if (!organization.data) fail("Client not found.", null, 404);

  const owner = await client
    .from("organization_memberships")
    .select("profile_id, profiles(full_name, email, phone)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const ownerProfile = (Array.isArray(owner.data?.profiles) ? owner.data?.profiles[0] : owner.data?.profiles) as
    | Row
    | undefined;

  const inserted = await client
    .from("clients")
    .insert({
      organization_id: organizationId,
      owner_user_id: owner.data?.profile_id ?? null,
      company_name: organization.data.name,
      primary_contact_name: ownerProfile?.full_name ?? null,
      primary_contact_email: ownerProfile?.email ?? null,
      primary_contact_phone: ownerProfile?.phone ?? null
    })
    .select("*")
    .single();

  if (inserted.error) fail("Could not create client details", inserted.error);
  return inserted.data as Row;
}

// Returns the public.operators row for a staff profile, creating it on first use.
export async function ensureOperatorRow(client: AdminClient, staffId: string): Promise<Row> {
  const existing = await client.from("operators").select("*").eq("user_id", staffId).maybeSingle();

  if (existing.error) fail("Could not read operator details", existing.error);
  if (existing.data) return existing.data as Row;

  const profile = await client.from("profiles").select("id, role, full_name, skills").eq("id", staffId).maybeSingle();
  if (profile.error) fail("Could not read profile", profile.error);
  if (!profile.data || profile.data.role !== "staff") fail("Operator not found.", null, 404);

  const inserted = await client
    .from("operators")
    .insert({
      user_id: staffId,
      display_name: profile.data.full_name,
      skill_tags: profile.data.skills ?? []
    })
    .select("*")
    .single();

  if (inserted.error) fail("Could not create operator details", inserted.error);
  return inserted.data as Row;
}

export async function updateClient(actorId: string, organizationId: string, input: UpdateClientInput) {
  const client = createAdminSupabaseClient();
  const before = await ensureClientRow(client, organizationId);
  const now = new Date().toISOString();

  const changes = dropUndefined({
    company_name: input.companyName,
    trading_name: emptyToNull(input.tradingName),
    primary_contact_name: emptyToNull(input.primaryContactName),
    primary_contact_email: emptyToNull(input.primaryContactEmail),
    primary_contact_phone: emptyToNull(input.primaryContactPhone),
    billing_contact_name: emptyToNull(input.billingContactName),
    billing_contact_email: emptyToNull(input.billingContactEmail),
    billing_contact_phone: emptyToNull(input.billingContactPhone),
    address_line_1: emptyToNull(input.addressLine1),
    address_line_2: emptyToNull(input.addressLine2),
    city: emptyToNull(input.city),
    region: emptyToNull(input.region),
    postcode: emptyToNull(input.postcode),
    country: emptyToNull(input.country),
    vat_number: emptyToNull(input.vatNumber),
    status: input.status,
    notes: input.notes === undefined ? undefined : input.notes.trim() || null
  });

  if (Object.keys(changes).length > 0) {
    const { error } = await client
      .from("clients")
      .update({ ...changes, updated_at: now })
      .eq("id", String(before.id));
    if (error) fail("Could not save client details", error);
  }

  if (input.companyName) {
    const { error } = await client.from("organizations").update({ name: input.companyName }).eq("id", organizationId);
    if (error) fail("Could not rename organisation", error);
  }

  let approvalWarning: string | undefined;

  if (input.onboardingStatus) {
    const previous = await client.from("organizations").select("onboarding_status").eq("id", organizationId).maybeSingle();
    const { error } = await client
      .from("organizations")
      .update({ onboarding_status: input.onboardingStatus })
      .eq("id", organizationId);
    if (error) fail("Could not update onboarding status", error);

    if (input.onboardingStatus === "approved" && previous.data?.onboarding_status !== "approved") {
      approvalWarning = await notifyApproval({
        profileId: String(before.owner_user_id ?? ""),
        role: "organiser",
        email: String(before.primary_contact_email ?? ""),
        recipientName: before.primary_contact_name ? String(before.primary_contact_name) : undefined
      });
    }
  }

  await writeAuditLog(client, {
    actorId,
    entityType: "client",
    entityId: organizationId,
    action: input.status && input.status !== before.status ? `Set client status to ${input.status}` : "Updated client",
    label: input.companyName ?? String(before.company_name ?? ""),
    summary: Object.keys(input).join(", "),
    before,
    after: { ...changes, onboarding_status: input.onboardingStatus }
  });

  return { warning: approvalWarning };
}

// Approval emails are a courtesy: the status change still stands if sending fails.
async function notifyApproval(input: Parameters<typeof sendOnboardingApprovedEmail>[0]) {
  if (!input.profileId || !input.email) {
    return "Approved, but there is no contact email to notify.";
  }

  try {
    await sendOnboardingApprovedEmail(input);
    return undefined;
  } catch (error) {
    console.error("[athena] onboarding approval email failed", error);
    return "Approved, but the approval email could not be sent.";
  }
}

export async function updateOperator(actorId: string, staffId: string, input: UpdateOperatorInput) {
  const client = createAdminSupabaseClient();
  const before = await ensureOperatorRow(client, staffId);
  const now = new Date().toISOString();

  const changes = dropUndefined({
    display_name: input.displayName,
    regions: input.regions,
    skill_tags: input.skillTags,
    verification_status: input.verificationStatus,
    is_active: input.isActive,
    total_cancellations: input.totalCancellations,
    total_no_shows: input.totalNoShows,
    notes: input.notes === undefined ? undefined : input.notes.trim() || null
  });

  if (Object.keys(changes).length > 0) {
    const { error } = await client
      .from("operators")
      .update({ ...changes, updated_at: now })
      .eq("id", String(before.id));
    if (error) fail("Could not save operator details", error);
  }

  const profileChanges = dropUndefined({
    display_name: input.displayName,
    onboarding_status: input.onboardingStatus
  });

  const previousProfile = await client
    .from("operator_profiles")
    .select("onboarding_status")
    .eq("profile_id", staffId)
    .maybeSingle();

  if (Object.keys(profileChanges).length > 0) {
    const { error } = await client
      .from("operator_profiles")
      .update({ ...profileChanges, updated_at: now })
      .eq("profile_id", staffId);
    if (error) fail("Could not update operator profile", error);
  }

  if (input.skillTags) {
    const { error } = await client.from("profiles").update({ skills: input.skillTags }).eq("id", staffId);
    if (error) fail("Could not update skills", error);
  }

  let action = "Updated operator";
  if (input.isActive === false) action = "Suspended operator";
  if (input.isActive === true && before.is_active === false) action = "Reactivated operator";
  if (input.verificationStatus && input.verificationStatus !== before.verification_status) {
    action = `Set verification to ${input.verificationStatus}`;
  }

  let approvalWarning: string | undefined;

  if (input.onboardingStatus === "approved" && previousProfile.data?.onboarding_status !== "approved") {
    action = "Approved operator onboarding";
    const profile = await client.from("profiles").select("full_name, email").eq("id", staffId).maybeSingle();
    approvalWarning = await notifyApproval({
      profileId: staffId,
      role: "staff",
      email: String(profile.data?.email ?? ""),
      recipientName: profile.data?.full_name ? String(profile.data.full_name) : undefined
    });
  }

  await writeAuditLog(client, {
    actorId,
    entityType: "operator",
    entityId: staffId,
    action,
    label: input.displayName ?? String(before.display_name ?? ""),
    summary: Object.keys(input).join(", "),
    before,
    after: { ...changes, ...profileChanges }
  });

  return { warning: approvalWarning };
}

export async function setOperatorPreference(actorId: string, organizationId: string, input: OperatorPreferenceInput) {
  const client = createAdminSupabaseClient();
  const clientRow = await ensureClientRow(client, organizationId);
  const operatorRow = await ensureOperatorRow(client, input.operatorId);

  if (input.enabled) {
    // Favourite and blocked are mutually exclusive.
    const opposite = input.preference === "favourite" ? "blocked" : "favourite";
    const removal = await client
      .from("client_operator_preferences")
      .delete()
      .eq("client_id", String(clientRow.id))
      .eq("operator_id", String(operatorRow.id))
      .eq("preference", opposite);
    if (removal.error) fail("Could not update preference", removal.error);

    const { error } = await client.from("client_operator_preferences").upsert(
      {
        client_id: clientRow.id,
        operator_id: operatorRow.id,
        preference: input.preference,
        reason: input.reason ?? null,
        created_by: actorId
      },
      { onConflict: "client_id,operator_id,preference" }
    );
    if (error) fail("Could not save preference", error);
  } else {
    const { error } = await client
      .from("client_operator_preferences")
      .delete()
      .eq("client_id", String(clientRow.id))
      .eq("operator_id", String(operatorRow.id))
      .eq("preference", input.preference);
    if (error) fail("Could not remove preference", error);
  }

  await writeAuditLog(client, {
    actorId,
    entityType: "client",
    entityId: organizationId,
    action: `${input.enabled ? "Added" : "Removed"} ${input.preference} operator`,
    label: String(clientRow.company_name ?? ""),
    summary: String(operatorRow.display_name ?? input.operatorId)
  });
}

export async function updateAssignment(actorId: string, jobId: string, input: UpdateAssignmentInput) {
  const client = createAdminSupabaseClient();
  const before = await client.from("jobs").select("id, title, status, charge_rate").eq("id", jobId).maybeSingle();

  if (before.error) fail("Could not read assignment", before.error);
  if (!before.data) fail("Assignment not found.", null, 404);

  const changes = dropUndefined({ charge_rate: input.chargeRate, status: input.status });

  if (Object.keys(changes).length === 0) return;

  const { error } = await client
    .from("jobs")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) fail("Could not update assignment", error);

  await writeAuditLog(client, {
    actorId,
    entityType: "assignment",
    entityId: jobId,
    action:
      input.status === "cancelled"
        ? "Cancelled assignment"
        : input.chargeRate !== undefined
          ? "Set charge rate"
          : "Updated assignment",
    label: String(before.data.title ?? ""),
    summary:
      input.chargeRate !== undefined
        ? `Charge rate ${before.data.charge_rate ?? "unset"} → ${input.chargeRate ?? "unset"}`
        : `Status ${before.data.status} → ${input.status}`,
    before: before.data,
    after: changes
  });
}
