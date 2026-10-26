import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminCampaigns } from "@/lib/queries/campaigns";
import { createCampaign } from "@/lib/services/admin-communications";
import { createCampaignSchema } from "@/lib/validation/campaign";

// Admin data is private and changes constantly: never cache it.
export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const campaigns = await getAdminCampaigns();
  return NextResponse.json(campaigns);
}

export async function POST(request: Request) {
  const { adminUser } = await requireAdmin();
  const body = await request.json();
  const payload = createCampaignSchema.parse(body);
  const campaign = await createCampaign(payload, adminUser.id);
  return NextResponse.json(campaign, { status: 201 });
}
