import type { Metadata } from "next";
import { AuditTimeline } from "@/components/admin/audit-timeline";
import { DetailHeader } from "@/components/admin/detail-header";
import { getAdminAuditLog } from "@/lib/queries/audit-log";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditLogPage() {
  const entries = await getAdminAuditLog();

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Audit log"
        title="Chronological internal system actions"
        description="Sensitive admin actions should be fully traceable across logins, user edits, assignment changes, exports, finance events, and campaign sends."
      />

      <AuditTimeline entries={entries} />
    </div>
  );
}
