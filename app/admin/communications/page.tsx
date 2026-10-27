import type { Metadata } from "next";
import Link from "next/link";
import { DetailHeader } from "@/components/admin/detail-header";
import { InsightCard } from "@/components/admin/insight-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Communications" };

export default function CommunicationsPage() {
  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Communications"
        title="Campaigns, audience segments, templates, and sends"
        description="Marketing and CRM admins can manage newsletters, lifecycle messaging, and service-line outreach without engineering support."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <InsightCard title="Campaign manager" description="Create, schedule, and inspect newsletter sends for clients, operators, or both.">
          <Link href="/admin/communications/campaigns">
            <Button variant="accent">Open campaigns</Button>
          </Link>
        </InsightCard>
        <InsightCard title="Template library" description="Manage Athena-branded lifecycle, service, finance, newsletter, and notification templates.">
          <Link href="/admin/communications/templates">
            <Button variant="secondary">Open templates</Button>
          </Link>
        </InsightCard>
        <InsightCard title="Delivery history" description="Inspect recent sends, provider status, and campaign output across the communications surface.">
          <Link href="/admin/communications/history">
            <Button variant="secondary">Open history</Button>
          </Link>
        </InsightCard>
      </div>
    </div>
  );
}
