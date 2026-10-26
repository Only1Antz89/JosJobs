import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminOnboarding } from "@/lib/queries/onboarding";

// Admin data is private and changes constantly: never cache it.
export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const onboarding = await getAdminOnboarding();
  return NextResponse.json(onboarding);
}
