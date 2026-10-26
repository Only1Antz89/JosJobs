import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { escapeHtml } from "@/lib/email/content";
import { sendMail } from "@/lib/email/mailer";
import { SITE_CONTACT } from "@/lib/site-content";
import { contactInquirySchema } from "@/lib/validation/schemas";

// Bots fill every field, so a filled hidden "website" field means the request is spam.
// We still answer "ok" so the bot learns nothing.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (body && typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const parsed = contactInquirySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." },
      { status: 400 }
    );
  }

  // Enquiries go to ATHENA_ENQUIRIES_EMAIL, or the public support inbox if that is not set.
  const recipient = env.enquiriesEmail || SITE_CONTACT.supportEmail;

  if (!env.hasSmtp2go) {
    console.error("[athena] Contact enquiry could not be delivered: email is not configured.");
    return NextResponse.json(
      { ok: false, error: `We couldn't send your enquiry right now. Please email ${SITE_CONTACT.supportEmail}.` },
      { status: 503 }
    );
  }

  const enquiry = parsed.data;
  const rows: Array<[string, string]> = [
    ["Name", enquiry.name],
    ["Email", enquiry.email],
    ["Event type", enquiry.eventType],
    ["Expected attendance", enquiry.expectedAttendance],
    ["Service needs", enquiry.serviceNeeds.join(", ")],
    ["Brief", enquiry.brief || "(none)"]
  ];

  try {
    await sendMail({
      to: recipient,
      subject: `New enquiry: ${enquiry.eventType} from ${enquiry.name}`,
      text: rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
      html: `<h2>New website enquiry</h2><table cellpadding="6">${rows
        .map(
          ([label, value]) =>
            `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value).replace(/\n/g, "<br />")}</td></tr>`
        )
        .join("")}</table>`,
      headers: { "Reply-To": enquiry.email }
    });
  } catch (error) {
    console.error("[athena] Contact enquiry email failed", error);
    return NextResponse.json(
      { ok: false, error: `We couldn't send your enquiry right now. Please email ${SITE_CONTACT.supportEmail}.` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
