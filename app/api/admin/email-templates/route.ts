import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminEmailTemplates } from "@/lib/queries/campaigns";

// Admin data is private and changes constantly: never cache it.
export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const templates = await getAdminEmailTemplates();
  return NextResponse.json(templates);
}
