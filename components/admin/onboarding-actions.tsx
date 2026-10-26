"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminRequest } from "@/lib/admin/request";
import type { OnboardingStatus } from "@/types/admin";

// Approve / reject buttons for one row of the onboarding queue. Approving sends
// the "you're approved" email from the server.
export function OnboardingActions({
  entityType,
  entityId,
  entityName,
  status,
  live
}: {
  entityType: "client" | "operator";
  entityId: string;
  entityName: string;
  status: OnboardingStatus;
  live: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<OnboardingStatus | null>(null);

  if (!live) {
    return <span className="text-xs text-slate">Demo data</span>;
  }

  async function setStatus(next: OnboardingStatus) {
    if (next === "rejected" && !window.confirm(`Reject ${entityName}? They won't be able to take part until approved.`)) {
      return;
    }

    setPending(next);
    try {
      const url = entityType === "client" ? `/api/admin/clients/${entityId}` : `/api/admin/operators/${entityId}`;
      const result = await adminRequest(url, "PATCH", { onboardingStatus: next });
      toast.success(
        next === "approved"
          ? `${entityName} approved. We've emailed them to let them know.`
          : next === "rejected"
            ? `${entityName} rejected.`
            : `${entityName} moved to review.`
      );
      if (result.warning) {
        toast.warning(result.warning);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update onboarding.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "approved" ? (
        <Button className="px-3 py-1.5 text-xs" disabled={pending !== null} onClick={() => setStatus("approved")}>
          {pending === "approved" ? "Approving..." : "Approve"}
        </Button>
      ) : null}
      {status === "pending" ? (
        <Button className="px-3 py-1.5 text-xs" variant="secondary" disabled={pending !== null} onClick={() => setStatus("in_review")}>
          Review
        </Button>
      ) : null}
      {status !== "rejected" ? (
        <Button className="px-3 py-1.5 text-xs" variant="secondary" disabled={pending !== null} onClick={() => setStatus("rejected")}>
          Reject
        </Button>
      ) : null}
    </div>
  );
}
