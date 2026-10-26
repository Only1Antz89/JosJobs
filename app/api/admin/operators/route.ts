import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/auth/admin-route";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminOperators } from "@/lib/queries/operators";
import { inviteOperator, inviteOperatorSchema } from "@/lib/services/admin-invites";

// Admin data is private and changes constantly: never cache it.
export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const operators = await getAdminOperators();
  return NextResponse.json(operators);
}

// Creates an operator account and emails them a link to set their password.
export const POST = adminRoute<Record<string, never>>(
  async (request, { adminUser }) => {
    const input = inviteOperatorSchema.parse(await readJson(request));
    const result = await inviteOperator(adminUser.id, input, new URL(request.url).origin);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  },
  { roles: ["operations_admin"], liveOnly: true }
);
