import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { exchangeGoogleCode } from "@/lib/services/admin-communications";

// Admin data is private and changes constantly: never cache it.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const isSecure = new URL(request.url).protocol === "https:";
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = cookies();
  const expectedState = cookieStore.get("athena_google_oauth_state")?.value;

  if (!code || !state || state !== expectedState) {
    cookieStore.delete("athena_google_oauth_state");
    return NextResponse.redirect(new URL("/admin/communications/campaigns/new?google=error", request.url));
  }

  const token = await exchangeGoogleCode(code);
  cookieStore.set("athena_google_access_token", token.access_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: token.expires_in,
    secure: isSecure
  });
  cookieStore.delete("athena_google_oauth_state");

  return NextResponse.redirect(new URL("/admin/communications/campaigns/new?google=connected", request.url));
}
