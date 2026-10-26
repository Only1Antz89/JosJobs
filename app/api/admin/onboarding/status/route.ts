import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, readJson } from "@/lib/auth/admin-route";
import { updateClient, updateOperator } from "@/lib/services/admin-mutations";

const updateOnboardingStatusSchema = z.object({
  entityType: z.enum(["organization", "operator_profile"]),
  entityId: z.string().uuid(),
  status: z.enum(["pending", "in_review", "approved", "rejected"])
});

// Kept for API compatibility; the portal now uses the client and operator PATCH routes.
export const POST = adminRoute<Record<string, never>>(
  async (request, { adminUser }) => {
    const payload = updateOnboardingStatusSchema.parse(await readJson(request));
    const result =
      payload.entityType === "organization"
        ? await updateClient(adminUser.id, payload.entityId, { onboardingStatus: payload.status })
        : await updateOperator(adminUser.id, payload.entityId, { onboardingStatus: payload.status });

    return NextResponse.json({ ok: true, warning: result.warning });
  },
  { roles: ["operations_admin"], liveOnly: true }
);
