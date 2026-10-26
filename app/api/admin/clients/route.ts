import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/auth/admin-route";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminClients } from "@/lib/queries/clients";
import { inviteClient, inviteClientSchema } from "@/lib/services/admin-invites";

// Admin data is private and changes constantly: never cache it.
export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const clients = await getAdminClients();
  return NextResponse.json(clients);
}

// Creates a client account and emails the contact a link to set their password.
export const POST = adminRoute<Record<string, never>>(
  async (request, { adminUser }) => {
    const input = inviteClientSchema.parse(await readJson(request));
    const result = await inviteClient(adminUser.id, input, new URL(request.url).origin);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  },
  { roles: ["operations_admin"], liveOnly: true }
);
