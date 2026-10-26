import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/auth/admin-route";
import { recordPayout, recordPayoutSchema } from "@/lib/services/admin-finance";

// Records money paid out to an operator (the transfer itself happens in your bank).
export const POST = adminRoute<Record<string, never>>(
  async (request, { adminUser }) => {
    const input = recordPayoutSchema.parse(await readJson(request));
    const result = await recordPayout(adminUser.id, input);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  },
  { roles: ["finance_admin"], liveOnly: true }
);
