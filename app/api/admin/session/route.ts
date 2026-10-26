import { NextResponse } from "next/server";
import { AdminAccessDeniedError, requireAdmin } from "@/lib/auth/require-admin";

// Admin data is private and changes constantly: never cache it.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { adminUser, user } = await requireAdmin({ redirectToLogin: false });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email ?? ""
      },
      adminUser
    });
  } catch (error) {
    if (error instanceof AdminAccessDeniedError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Admin access required."
        },
        { status: 401 }
      );
    }

    throw error;
  }
}
