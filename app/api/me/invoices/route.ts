import { NextResponse } from "next/server";
import { getRuntimeMode } from "@/lib/env";
import { invoiceDisplayStatus, roundMoney } from "@/lib/finance/billing";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The signed-in client's invoices. Row-level security limits this to invoices
// for companies they own, and hides drafts and void invoices.
export async function GET() {
  if (getRuntimeMode() !== "live") {
    return NextResponse.json({ invoices: [] });
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in to see invoices." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("client_invoices")
    .select("invoice_number, issue_date, due_date, total_amount, amount_paid, status, access_token")
    .order("issue_date", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[athena] client invoices failed", error);
    return NextResponse.json({ ok: false, error: "Could not load invoices." }, { status: 500 });
  }

  return NextResponse.json({
    invoices: (data ?? []).map((row) => ({
      invoiceNumber: row.invoice_number,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      totalAmount: roundMoney(Number(row.total_amount)),
      balance: roundMoney(Math.max(Number(row.total_amount) - Number(row.amount_paid), 0)),
      status: invoiceDisplayStatus(row),
      href: `/invoices/${row.access_token}`
    }))
  });
}
