import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/auth/admin-route";
import { recordInvoicePayment, recordPaymentSchema } from "@/lib/services/admin-finance";

// Records a bank transfer (or other manual payment) against an invoice.
export const POST = adminRoute<{ invoiceId: string }>(
  async (request, { params, adminUser }) => {
    const input = recordPaymentSchema.parse(await readJson(request));
    const result = await recordInvoicePayment({
      actorId: adminUser.id,
      invoiceId: params.invoiceId,
      amount: input.amount,
      paymentDate: input.paymentDate,
      method: "bank_transfer",
      reference: input.reference
    });
    return NextResponse.json({
      ok: true,
      warning: result.recorded ? undefined : "A payment with this reference was already recorded."
    });
  },
  { roles: ["finance_admin"], liveOnly: true }
);
