import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminAssignments } from "@/lib/queries/assignments";

// Admin data is private and changes constantly: never cache it.
export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const assignments = await getAdminAssignments();
  return NextResponse.json(assignments);
}
