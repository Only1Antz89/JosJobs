import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminFinance } from "@/lib/queries/finance";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const finance = await getAdminFinance();
  return NextResponse.json(finance);
}
