import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/auth/admin-route";
import { sendInvoice } from "@/lib/services/admin-finance";

// Sends a draft invoice, or a payment reminder for one that's already been sent.
export const POST = adminRoute<{ invoiceId: string }>(
  async (request, { params, adminUser }) => {
    const result = await sendInvoice(adminUser.id, params.invoiceId, new URL(request.url).origin);
    return NextResponse.json({ ok: true, ...result });
  },
  { roles: ["finance_admin"], liveOnly: true }
);
