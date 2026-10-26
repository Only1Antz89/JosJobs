"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminRequest } from "@/lib/admin/request";

// Sets what the client is charged per worker per hour for one assignment.
// Invoices and revenue figures are worked out from this rate.
export function ChargeRateForm({
  assignmentId,
  chargeRate,
  payRate,
  live
}: {
  assignmentId: string;
  chargeRate: number;
  payRate: number;
  live: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(chargeRate > 0 ? chargeRate.toFixed(2) : "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = value.trim() === "" ? null : Number(value);

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      toast.error("Enter a rate in pounds, for example 18.50.");
      return;
    }

    setSaving(true);
    try {
      await adminRequest(`/api/admin/assignments/${assignmentId}`, "PATCH", { chargeRate: parsed });
      toast.success(parsed === null ? "Charge rate cleared." : "Charge rate saved.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the charge rate.");
    } finally {
      setSaving(false);
    }
  }

  const margin = Number(value) > 0 ? Number(value) - payRate : null;

  return (
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleSubmit}>
      <label className="grid gap-1 text-sm">
        <span className="text-slate">Client charge per worker per hour (£)</span>
        <Input
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Not set"
          disabled={!live || saving}
          className="sm:w-40"
        />
      </label>
      <Button type="submit" variant="secondary" disabled={!live || saving}>
        {saving ? "Saving..." : "Save rate"}
      </Button>
      <p className="text-xs text-slate sm:pb-3">
        {live
          ? margin === null
            ? `Pay rate is £${payRate.toFixed(2)}/hr.`
            : `Pay rate £${payRate.toFixed(2)}/hr, margin £${margin.toFixed(2)}/hr.`
          : "Demo data: rates can't be changed."}
      </p>
    </form>
  );
}
