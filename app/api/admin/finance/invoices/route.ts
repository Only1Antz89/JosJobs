import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/auth/admin-route";
import { createInvoice, createInvoiceSchema } from "@/lib/services/admin-finance";

// Drafts an invoice from finished jobs (and any extra lines). Amounts are worked out on the server.
export const POST = adminRoute<Record<string, never>>(
  async (request, { adminUser }) => {
    const input = createInvoiceSchema.parse(await readJson(request));
    const result = await createInvoice(adminUser.id, input);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  },
  { roles: ["finance_admin"], liveOnly: true }
);
