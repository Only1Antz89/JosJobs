import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/auth/admin-route";
import { getAdminClientById } from "@/lib/queries/clients";
import { updateClient, updateClientSchema } from "@/lib/services/admin-mutations";

export const GET = adminRoute<{ clientId: string }>(async (_request, { params }) => {
  const client = await getAdminClientById(params.clientId);

  if (!client) {
    return NextResponse.json({ ok: false, error: "Client not found." }, { status: 404 });
  }

  return NextResponse.json(client);
});

export const PATCH = adminRoute<{ clientId: string }>(
  async (request, { params, adminUser }) => {
    const input = updateClientSchema.parse(await readJson(request));
    const result = await updateClient(adminUser.id, params.clientId, input);
    return NextResponse.json({ ok: true, warning: result.warning });
  },
  { roles: ["operations_admin", "finance_admin"], liveOnly: true }
);
