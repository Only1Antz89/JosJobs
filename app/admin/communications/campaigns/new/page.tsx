import type { Metadata } from "next";
import { CampaignComposer } from "@/components/admin/campaign-composer";
import { DetailHeader } from "@/components/admin/detail-header";
import { getAdminEmailDeliveries, getAdminEmailTemplates } from "@/lib/queries/campaigns";

export const metadata: Metadata = { title: "New campaign" };

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const [templates, deliveries] = await Promise.all([
    getAdminEmailTemplates(),
    getAdminEmailDeliveries()
  ]);

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="New campaign"
        title="Compose a campaign"
        description="Create Athena-branded newsletters and lifecycle email drafts with preview, test send, scheduling, and Google Docs import."
      />
      <CampaignComposer templates={templates} deliveries={deliveries} />
    </div>
  );
}
