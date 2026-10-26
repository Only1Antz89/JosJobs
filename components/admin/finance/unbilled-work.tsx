"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminRequest } from "@/lib/admin/request";
import type { UnbilledClient } from "@/lib/services/admin-finance";
import { formatMoney } from "@/lib/utils";

// Finished jobs that haven't been invoiced yet, grouped by client.
// Pick jobs and create a draft invoice; nothing is sent until you press Send.
export function UnbilledWork({ unbilled }: { unbilled: UnbilledClient[] }) {
  if (unbilled.length === 0) {
    return (
      <Card className="rounded-[28px] p-5 text-sm text-slate">
        Nothing to invoice. Finished jobs with accepted staff will appear here.
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {unbilled.map((entry) => (
        <UnbilledClientCard key={entry.organizationId} entry={entry} />
      ))}
    </div>
  );
}

function UnbilledClientCard({ entry }: { entry: UnbilledClient }) {
  const router = useRouter();
  const billableIds = entry.jobs.filter((job) => job.chargeRate !== null).map((job) => job.jobId);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(billableIds));
  const [saving, setSaving] = useState(false);

  const selectedTotal = useMemo(
    () => entry.jobs.filter((job) => selected.has(job.jobId)).reduce((sum, job) => sum + job.amount, 0),
    [entry.jobs, selected]
  );

  function toggle(jobId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  async function createDraft() {
    setSaving(true);
    try {
      const result = await adminRequest("/api/admin/finance/invoices", "POST", {
        organizationId: entry.organizationId,
        jobIds: [...selected]
      });
      toast.success(`Draft ${String(result.invoiceNumber)} created. Check it, then press Send.`);
      router.push(`/admin/finance/invoices/${String(result.id)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the invoice.");
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-ink">{entry.clientName}</p>
          <p className="text-sm text-slate">
            {entry.jobs.length} finished {entry.jobs.length === 1 ? "job" : "jobs"} not invoiced
            {entry.missingRates > 0 ? `, ${entry.missingRates} without a charge rate` : ""}
          </p>
        </div>
        <Button disabled={saving || selected.size === 0} onClick={createDraft}>
          {saving ? "Creating..." : `Draft invoice · ${formatMoney(selectedTotal)}`}
        </Button>
      </div>

      <ul className="mt-4 divide-y divide-white/8">
        {entry.jobs.map((job) => {
          const missingRate = job.chargeRate === null;
          return (
            <li key={job.jobId} className="flex items-start gap-3 py-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-current"
                aria-label={`Include ${job.title}`}
                checked={selected.has(job.jobId)}
                disabled={missingRate || saving}
                onChange={() => toggle(job.jobId)}
              />
              <div className="flex-1">
                <p className="text-ink">{job.description}</p>
                {missingRate ? (
                  <Link className="text-xs text-amber-300 underline" href={`/admin/assignments/${job.jobId}#financials`}>
                    Set a charge rate to bill this job
                  </Link>
                ) : (
                  <p className="text-xs text-slate">
                    {job.workerHours} worker-hours × {formatMoney(job.chargeRate ?? 0)}
                  </p>
                )}
              </div>
              <p className="text-ink">{missingRate ? "–" : formatMoney(job.amount)}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
