import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendJobConfirmationEmails } from "@/lib/services/admin-communications";

const updateApplicationStatusSchema = z.object({
  status: z.enum(["pending", "accepted", "rejected", "withdrawn"])
});

export async function POST(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  const parsed = updateApplicationStatusSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
  }

  const payload = parsed.data;
  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role !== "organiser") {
    return NextResponse.json({ ok: false, error: "Organiser account required." }, { status: 403 });
  }

  const { data: updatedRows, error } = await supabase
    .from("applications")
    .update({ status: payload.status })
    .eq("id", params.applicationId)
    .select("id");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  // Row-level security silently skips rows this client does not own, so an empty
  // result means the application is not theirs. Stop before sending any emails.
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ ok: false, error: "Application not found." }, { status: 404 });
  }

  if (payload.status === "accepted") {
    try {
      await sendJobConfirmationEmails({ applicationId: params.applicationId });
    } catch (sendError) {
      console.error(sendError);
      return NextResponse.json({
        ok: true,
        warning: "Assignment confirmed, but the confirmation email could not be sent."
      });
    }
  }

  return NextResponse.json({ ok: true });
}
