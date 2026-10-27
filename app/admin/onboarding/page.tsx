import type { Metadata } from "next";
import { AdminDataTable } from "@/components/admin/data-table";
import { DetailHeader } from "@/components/admin/detail-header";
import { OnboardingActions } from "@/components/admin/onboarding-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { getRuntimeMode } from "@/lib/env";
import { getAdminOnboarding } from "@/lib/queries/onboarding";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const onboarding = await getAdminOnboarding();
  const clients = onboarding.filter((item) => item.entityType === "client");
  const operators = onboarding.filter((item) => item.entityType === "operator");
  const live = getRuntimeMode() === "live";

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Manual onboarding"
        title="Pending client and operator setup work"
        description="Approve new clients and operators here. Approving sends them an email so they know they can start."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminDataTable
          columns={[
            { key: "entity", label: "Pending client onboarding" },
            { key: "status", label: "Status" },
            { key: "owner", label: "Owner" },
            { key: "updated", label: "Updated" },
            { key: "actions", label: "Actions" }
          ]}
          rows={clients.map((item) => ({
            id: item.id,
            cells: {
              entity: item.entityName,
              status: <StatusBadge value={item.status} />,
              owner: item.owner,
              updated: formatDateTime(item.updatedAt),
              actions: (
                <OnboardingActions
                  entityType={item.entityType}
                  entityId={item.entityId}
                  entityName={item.entityName}
                  status={item.status}
                  live={live}
                />
              )
            }
          }))}
        />

        <AdminDataTable
          columns={[
            { key: "entity", label: "Pending operator onboarding" },
            { key: "status", label: "Status" },
            { key: "owner", label: "Owner" },
            { key: "updated", label: "Updated" },
            { key: "actions", label: "Actions" }
          ]}
          rows={operators.map((item) => ({
            id: item.id,
            cells: {
              entity: item.entityName,
              status: <StatusBadge value={item.status} />,
              owner: item.owner,
              updated: formatDateTime(item.updatedAt),
              actions: (
                <OnboardingActions
                  entityType={item.entityType}
                  entityId={item.entityId}
                  entityName={item.entityName}
                  status={item.status}
                  live={live}
                />
              )
            }
          }))}
        />
      </div>
    </div>
  );
}
