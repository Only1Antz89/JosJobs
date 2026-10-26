import { NextResponse } from "next/server";
import { env, getRuntimeMode } from "@/lib/env";
import { processSmtp2goWebhook } from "@/lib/services/admin-communications";

function isAuthorised(request: Request) {
  if (!env.smtp2goWebhookAuth) {
    // Without a shared secret anyone could post fake bounces and unsubscribe real
    // recipients, so a live site refuses the webhook until SMTP2GO_WEBHOOK_AUTH is set.
    return getRuntimeMode() !== "live";
  }

  return request.headers.get("authorization") === env.smtp2goWebhookAuth;
}

async function readWebhookPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown> | Array<Record<string, unknown>>;
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries()) as Record<string, unknown>;
  }

  return {};
}

export async function POST(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const payload = await readWebhookPayload(request);
  const events = Array.isArray(payload) ? payload : [payload];

  for (const event of events) {
    await processSmtp2goWebhook(event);
  }

  return NextResponse.json({ ok: true, processed: events.length });
}
