import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailHeader } from "@/components/admin/detail-header";
import { OperatorDetailInsights } from "@/components/admin/operator-detail-insights";
import { Button } from "@/components/ui/button";
import { getAdminOperatorById } from "@/lib/queries/operators";

export const metadata: Metadata = { title: "Operator" };

export default async function OperatorDetailPage({
  params
}: {
  params: { operatorId: string };
}) {
  const operator = await getAdminOperatorById(params.operatorId);

  if (!operator) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <DetailHeader
        eyebrow="Operator detail"
        title={operator.displayName}
        description="Profile, compliance, role-fit analytics, historical earnings, projected income, and auditability."
        status={operator.verificationStatus}
        meta={operator.email}
        actions={
          <Link href={`/admin/operators/${operator.id}/workspace`}>
            <Button variant="secondary">View operator workspace</Button>
          </Link>
        }
      />

      <OperatorDetailInsights operator={operator} />
    </div>
  );
}
