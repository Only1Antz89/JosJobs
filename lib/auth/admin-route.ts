import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AdminAccessDeniedError, requireAdmin } from "@/lib/auth/require-admin";
import { getRuntimeMode } from "@/lib/env";
import { AppError, toDisplayError } from "@/lib/errors";
import type { AdminIdentity, AdminRole } from "@/types/admin";

type AdminContext = { adminUser: AdminIdentity };

// Wraps an admin API handler: answers 401/403 as JSON instead of redirecting,
// turns validation and app errors into readable messages, and optionally limits
// the handler to certain admin roles (super admins can always act).
export function adminRoute<Params>(
  handler: (request: Request, context: { params: Params } & AdminContext) => Promise<Response>,
  options: { roles?: AdminRole[]; liveOnly?: boolean } = {}
) {
  return async (request: Request, { params }: { params: Params }) => {
    let adminUser: AdminIdentity;

    try {
      ({ adminUser } = await requireAdmin({ redirectToLogin: false }));
    } catch (error) {
      if (error instanceof AdminAccessDeniedError) {
        return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 401 });
      }
      throw error;
    }

    if (options.roles && adminUser.adminRole !== "super_admin" && !options.roles.includes(adminUser.adminRole)) {
      return NextResponse.json({ ok: false, error: "Your admin role cannot do this." }, { status: 403 });
    }

    if (options.liveOnly && getRuntimeMode() !== "live") {
      return NextResponse.json(
        { ok: false, error: "This action needs the live database. Demo mode changes are not saved." },
        { status: 409 }
      );
    }

    try {
      return await handler(request, { params, adminUser });
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json({ ok: false, error: toDisplayError(error) }, { status: 400 });
      }

      if (error instanceof AppError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
      }

      console.error("[athena] admin route failed", error);
      return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("Request body must be JSON.", "INVALID_JSON", 400);
  }
}
