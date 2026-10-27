import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientDetailInsights } from "@/components/admin/client-detail-insights";
import { DetailHeader } from "@/components/admin/detail-header";
import { Button } from "@/components/ui/button";
import { getAdminClientById } from "@/lib/queries/clients";

export const metadata: Metadata = { title: "Client" };

export default async function ClientDetailPage({
  params
}: {
  params: { clientId: string };
}) {
  const client = await getAdminClientById(params.clientId);

  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Client detail"
        title={client.companyName}
        description="Overview, historical and future event costs, tech rentals, service charge breakdowns, repeat operators, and client-specific audit context."
        status={client.status}
        meta={`${client.primaryContactName} • ${client.primaryContactEmail}`}
        actions={
          <Link href={`/admin/clients/${client.id}/workspace`}>
            <Button variant="secondary">View client workspace</Button>
          </Link>
        }
      />

      <ClientDetailInsights client={client} />
    </div>
  );
}
