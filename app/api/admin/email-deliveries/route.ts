import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminEmailDeliveries } from "@/lib/queries/campaigns";

// Admin data is private and changes constantly: never cache it.
export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const deliveries = await getAdminEmailDeliveries();
  return NextResponse.json(deliveries);
}
