import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CampaignComposer } from "@/components/admin/campaign-composer";
import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { getAdminCampaignById, getAdminEmailDeliveries, getAdminEmailTemplates } from "@/lib/queries/campaigns";
import { formatDateTime } from "@/lib/utils";
import { EMAIL_TEMPLATE_LABELS } from "@/types/admin";

export const metadata: Metadata = { title: "Campaign" };

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params
}: {
  params: { campaignId: string };
}) {
  const [campaign, templates, deliveries] = await Promise.all([
    getAdminCampaignById(params.campaignId),
    getAdminEmailTemplates(),
    getAdminEmailDeliveries()
  ]);

  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Campaign detail"
        title={campaign.name}
        description={campaign.previewText}
        status={campaign.status}
        meta={`${campaign.subject} • ${campaign.audience}`}
      />

      <AdminDataTable
        columns={[
          { key: "field", label: "Field" },
          { key: "value", label: "Value" }
        ]}
        rows={[
          { id: "template", cells: { field: "Template", value: EMAIL_TEMPLATE_LABELS[campaign.templateType] } },
          { id: "audience", cells: { field: "Audience", value: `${campaign.audience} (${campaign.audienceCount})` } },
          { id: "segment", cells: { field: "Segment key", value: campaign.segmentKey } },
          { id: "schedule", cells: { field: "Scheduled / sent", value: campaign.sentAt ?? campaign.scheduledAt ? formatDateTime(campaign.sentAt ?? campaign.scheduledAt!) : "Not scheduled" } },
          { id: "status", cells: { field: "Status", value: <StatusBadge value={campaign.status} /> } }
        ]}
      />

      <AdminDataTable
        columns={[
          { key: "label", label: "Recipient segment" },
          { key: "count", label: "Count" }
        ]}
        rows={campaign.recipientBreakdown.map((item) => ({
          id: item.label,
          cells: {
            label: item.label,
            count: item.count
          }
        }))}
      />
      <CampaignComposer initialCampaign={campaign} templates={templates} deliveries={deliveries} />
    </div>
  );
}
