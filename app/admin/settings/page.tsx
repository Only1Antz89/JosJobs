import type { Metadata } from "next";
import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Settings"
        title="Admin-only configuration surface"
        description="Reserved for RBAC rules, provider keys, operational thresholds, export limits, and campaign defaults."
      />

      <AdminDataTable
        columns={[
          { key: "area", label: "Area" },
          { key: "note", label: "Current scaffold" }
        ]}
        rows={[
          { id: "rbac", cells: { area: "RBAC", note: "Backed by `admin_users` and `requireAdmin()`." } },
          { id: "exports", cells: { area: "Exports", note: "Queue-backed export jobs are represented in `export_jobs` and `/api/admin/exports`." } },
          { id: "campaigns", cells: { area: "Campaigns", note: "Server-side mail sending remains the recommended privileged path." } }
        ]}
      />
    </div>
  );
}
