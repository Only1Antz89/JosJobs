import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { buildGoogleAuthUrl } from "@/lib/services/admin-communications";

// Admin data is private and changes constantly: never cache it.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireAdmin();
  const state = crypto.randomUUID();
  const isSecure = new URL(request.url).protocol === "https:";

  cookies().set("athena_google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure
  });

  const url = new URL(buildGoogleAuthUrl());
  url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
