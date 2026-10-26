import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/auth/admin-route";
import { operatorPreferenceSchema, setOperatorPreference } from "@/lib/services/admin-mutations";

export const POST = adminRoute<{ clientId: string }>(
  async (request, { params, adminUser }) => {
    const input = operatorPreferenceSchema.parse(await readJson(request));
    await setOperatorPreference(adminUser.id, params.clientId, input);
    return NextResponse.json({ ok: true });
  },
  { roles: ["operations_admin"], liveOnly: true }
);
