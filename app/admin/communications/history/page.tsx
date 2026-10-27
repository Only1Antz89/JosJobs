import type { Metadata } from "next";
import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { getAdminEmailDeliveries } from "@/lib/queries/campaigns";
import { formatDateTime } from "@/lib/utils";
import { EMAIL_TEMPLATE_LABELS } from "@/types/admin";

export const metadata: Metadata = { title: "Email history" };

export const dynamic = "force-dynamic";

export default async function EmailHistoryPage() {
  const deliveries = await getAdminEmailDeliveries();

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Delivery history"
        title="Recent SMTP2GO sends and outcomes"
        description="Track campaign and transactional email output across Athena Pro communications."
      />

      <AdminDataTable
        columns={[
          { key: "recipient", label: "Recipient" },
          { key: "template", label: "Template" },
          { key: "subject", label: "Subject" },
          { key: "status", label: "Status" },
          { key: "sentAt", label: "Timestamp" }
        ]}
        rows={deliveries.map((delivery) => ({
          id: delivery.id,
          cells: {
            recipient: delivery.recipientEmail,
            template: EMAIL_TEMPLATE_LABELS[delivery.templateType],
            subject: delivery.subject,
            status: <StatusBadge value={delivery.status} />,
            sentAt: delivery.sentAt ? formatDateTime(delivery.sentAt) : formatDateTime(delivery.createdAt)
          }
        }))}
      />
    </div>
  );
}
