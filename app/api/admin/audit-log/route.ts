import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminAuditLog } from "@/lib/queries/audit-log";

// Admin data is private and changes constantly: never cache it.
export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const entries = await getAdminAuditLog();
  return NextResponse.json(entries);
}
