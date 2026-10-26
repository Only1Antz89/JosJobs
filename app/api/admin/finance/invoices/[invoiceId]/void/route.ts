import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/auth/admin-route";
import { voidInvoice } from "@/lib/services/admin-finance";

export const POST = adminRoute<{ invoiceId: string }>(
  async (_request, { params, adminUser }) => {
    const result = await voidInvoice(adminUser.id, params.invoiceId);
    return NextResponse.json({ ok: true, ...result });
  },
  { roles: ["finance_admin"], liveOnly: true }
);
