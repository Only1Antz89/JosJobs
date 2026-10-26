"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { adminRequest } from "@/lib/admin/request";
import type { OperatorBalance } from "@/lib/services/admin-finance";
import { formatMoney } from "@/lib/utils";

// What each operator has earned on finished shifts, and a form to record a payout
// once you've paid them from the bank.
export function PayoutPanel({ balances }: { balances: OperatorBalance[] }) {
  const owed = balances.filter((entry) => entry.owed > 0);

  if (owed.length === 0) {
    return <Card className="rounded-[28px] p-5 text-sm text-slate">No operator pay is outstanding.</Card>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {owed.map((entry) => (
        <PayoutCard key={entry.staffId} entry={entry} />
      ))}
    </div>
  );
}

function PayoutCard({ entry }: { entry: OperatorBalance }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState(entry.owed.toFixed(2));
  const [periodStart, setPeriodStart] = useState(() => {
    const date = new Date(entry.lastShiftEnd || Date.now());
    date.setUTCDate(1);
    return date.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => (entry.lastShiftEnd || new Date().toISOString()).slice(0, 10));
  const [reference, setReference] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter the amount you paid.");
      return;
    }
    setSaving(true);
    try {
      await adminRequest("/api/admin/finance/payouts", "POST", {
        staffId: entry.staffId,
        amount: value,
        periodStart,
        periodEnd,
        reference: reference.trim() || undefined
      });
      toast.success(`Payout of ${formatMoney(value)} to ${entry.name} recorded.`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the payout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-ink">{entry.name}</p>
          <p className="text-sm text-slate">
            {entry.shifts} {entry.shifts === 1 ? "shift" : "shifts"} · earned {formatMoney(entry.earned)} · paid{" "}
            {formatMoney(entry.paidOut)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">Owed</p>
          <p className="text-xl font-semibold text-ink">{formatMoney(entry.owed)}</p>
        </div>
      </div>

      {open ? (
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <Field label="Amount paid (£)">
            <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </Field>
          <Field label="Bank reference (optional)">
            <Input value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>
          <Field label="Work from">
            <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} required />
          </Field>
          <Field label="Work to">
            <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} required />
          </Field>
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Record payout"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button className="mt-4" variant="secondary" onClick={() => setOpen(true)}>
          Record payout
        </Button>
      )}
    </Card>
  );
}
