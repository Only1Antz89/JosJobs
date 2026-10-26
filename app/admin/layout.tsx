import { AdminHeader } from "@/components/admin/header";
import { AdminSidebar } from "@/components/admin/sidebar";
import { requireAdmin } from "@/lib/auth/require-admin";

// Admin pages show private, changing data: always render per request, never cache.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { adminUser } = await requireAdmin();

  return (
    <main className="min-h-screen px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:gap-6">
        <AdminSidebar adminName={adminUser.fullName} role={adminUser.adminRole} />
        <div className="min-w-0 flex-1 space-y-6">
          <AdminHeader adminName={adminUser.fullName} role={adminUser.adminRole} />
          {children}
        </div>
      </div>
    </main>
  );
}
