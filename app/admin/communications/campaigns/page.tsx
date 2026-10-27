import type { Metadata } from "next";
import Link from "next/link";
import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { getAdminCampaigns } from "@/lib/queries/campaigns";
import { formatDateTime } from "@/lib/utils";
import { EMAIL_TEMPLATE_LABELS } from "@/types/admin";

export const metadata: Metadata = { title: "Campaigns" };

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await getAdminCampaigns();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <DetailHeader
          eyebrow="Campaigns"
          title="Templates, segment counts, send status, and history"
          description="This is the operational campaign index for newsletters and audience messaging."
        />
        <Link href="/admin/communications/campaigns/new">
          <Button variant="accent">New campaign</Button>
        </Link>
      </div>

      <AdminDataTable
        columns={[
          { key: "campaign", label: "Campaign" },
          { key: "template", label: "Template" },
          { key: "audience", label: "Audience" },
          { key: "status", label: "Status" },
          { key: "delivery", label: "Delivery" }
        ]}
        rows={campaigns.map((campaign) => ({
          id: campaign.id,
          cells: {
            campaign: (
              <div>
                <Link href={`/admin/communications/campaigns/${campaign.id}`} className="font-medium text-ink hover:text-mist">
                  {campaign.name}
                </Link>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate">{campaign.subject}</p>
                <p className="mt-2 text-sm text-slate">{campaign.previewText}</p>
              </div>
            ),
            template: EMAIL_TEMPLATE_LABELS[campaign.templateType],
            audience: `${campaign.audience} • ${campaign.audienceCount}`,
            status: <StatusBadge value={campaign.status} />,
            delivery:
              campaign.sentAt ?? campaign.scheduledAt
                ? formatDateTime(campaign.sentAt ?? campaign.scheduledAt!)
                : "Not scheduled"
          }
        }))}
      />
    </div>
  );
}
