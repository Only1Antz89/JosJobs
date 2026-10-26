import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminExportJobs } from "@/lib/queries/reports";

export const dynamic = "force-dynamic";

// Export history. Downloads themselves are at /api/admin/exports/[type].
export async function GET() {
  await requireAdmin();
  const jobs = await getAdminExportJobs();
  return NextResponse.json(jobs);
}
