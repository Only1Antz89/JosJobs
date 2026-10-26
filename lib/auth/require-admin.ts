import { redirect } from "next/navigation";
import { getRuntimeMode, isProductionDemo } from "@/lib/env";
import { getAdminDataset } from "@/lib/queries/admin-dataset";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminRole } from "@/types/admin";

export class AdminAccessDeniedError extends Error {
  constructor() {
    super("Admin access required.");
    this.name = "AdminAccessDeniedError";
  }
}

const ADMIN_ROLES: AdminRole[] = [
  "super_admin",
  "operations_admin",
  "finance_admin",
  "marketing_admin"
];

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && ADMIN_ROLES.includes(value as AdminRole);
}

function denyAdminAccess(redirectToLogin: boolean): never {
  if (redirectToLogin) {
    redirect("/admin-login");
  }

  throw new AdminAccessDeniedError();
}

export async function requireAdmin({
  redirectToLogin = true
}: {
  redirectToLogin?: boolean;
} = {}) {
  if (getRuntimeMode() === "demo") {
    // The demo admin workspace is open to anyone, so never serve it from a production
    // deploy that has lost its Supabase settings.
    if (isProductionDemo()) {
      console.error("[athena] Admin access refused: production build is running without Supabase.");
      denyAdminAccess(redirectToLogin);
    }

    const data = await getAdminDataset();
    return {
      user: {
        id: data.admin.id,
        email: data.admin.email
      },
      adminUser: data.admin
    };
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    denyAdminAccess(redirectToLogin);
  }

  const { data: adminUser, error: adminUserError } = await supabase
    .from("admin_users")
    .select("admin_role, is_active")
    .eq("id", user.id)
    .single();

  if (adminUser?.is_active) {
    return {
      user,
      adminUser: {
        id: user.id,
        fullName: user.user_metadata.full_name ?? "Athena Admin",
        email: user.email ?? "",
        adminRole: adminUser.admin_role,
        isActive: adminUser.is_active
      }
    };
  }

  if (!adminUserError && adminUser && !adminUser.is_active) {
    denyAdminAccess(redirectToLogin);
  }

  const metadataRole = user.app_metadata?.admin_role;
  const metadataIsActive = user.app_metadata?.is_active !== false;

  if (!isAdminRole(metadataRole) || !metadataIsActive) {
    denyAdminAccess(redirectToLogin);
  }

  return {
    user,
    adminUser: {
      id: user.id,
      fullName: user.user_metadata.full_name ?? "Athena Admin",
      email: user.email ?? "",
      adminRole: metadataRole,
      isActive: true
    }
  };
}
