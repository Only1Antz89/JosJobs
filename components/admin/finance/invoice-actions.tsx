"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { adminRequest } from "@/lib/admin/request";
import type { FinanceInvoice, FinanceSettings } from "@/lib/services/admin-finance";
import { formatMoney } from "@/lib/utils";

export function InvoiceActions({
  invoice,
  settings,
  clientLink
}: {
  invoice: FinanceInvoice;
  settings: FinanceSettings;
  clientLink: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [amount, setAmount] = useState(invoice.balance > 0 ? invoice.balance.toFixed(2) : "");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");

  const isOpen = invoice.status !== "void" && invoice.status !== "paid";
  const isDraft = invoice.status === "draft";

  async function run(key: string, action: () => Promise<{ warning?: string }>, success: string) {
    setBusy(key);
    try {
      const result = await action();
      toast.success(success);
      if (result.warning) toast.warning(result.warning);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (isDraft && !window.confirm(`Send ${invoice.invoiceNumber} to ${invoice.billingEmail || "the client"}?`)) return;
    await run(
      "send",
      () => adminRequest(`/api/admin/finance/invoices/${invoice.id}/send`, "POST"),
      isDraft ? "Invoice sent." : "Reminder sent."
    );
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter the amount received.");
      return;
    }
    const ok = await run(
      "payment",
      () =>
        adminRequest(`/api/admin/finance/invoices/${invoice.id}/payments`, "POST", {
          amount: value,
          paymentDate,
          reference: reference.trim() || undefined
        }),
      `${formatMoney(value)} recorded.`
    );
    if (ok) setReference("");
  }

  async function voidInvoice() {
    if (!window.confirm(`Void ${invoice.invoiceNumber}? Its jobs go back to "Ready to invoice". This can't be undone.`)) return;
    await run("void", () => adminRequest(`/api/admin/finance/invoices/${invoice.id}/void`, "POST"), "Invoice voided.");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(clientLink);
      toast.success("Client invoice link copied.");
    } catch {
      window.prompt("Copy the client invoice link:", clientLink);
    }
  }

  if (!isOpen && invoice.status !== "paid") {
    return null;
  }

  return (
    <Card className="space-y-5 rounded-[28px] p-5 print:hidden">
      {!settings.hasBankDetails && !settings.hasStripe ? (
        <p className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-ink">
          Add your bank details (and Stripe keys for card payments) to the site settings before sending invoices.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {isOpen ? (
          <Button disabled={busy !== null || !invoice.billingEmail} onClick={send}>
            {busy === "send" ? "Sending..." : isDraft ? "Send invoice" : "Send reminder"}
          </Button>
        ) : null}
        {!isDraft ? (
          <Button variant="secondary" onClick={copyLink}>
            Copy client link
          </Button>
        ) : null}
        {isOpen && invoice.amountPaid === 0 ? (
          <Button variant="secondary" disabled={busy !== null} onClick={voidInvoice}>
            {busy === "void" ? "Voiding..." : "Void invoice"}
          </Button>
        ) : null}
      </div>
      {!invoice.billingEmail ? (
        <p className="text-sm text-slate">This client has no billing or contact email. Add one on the management desk first.</p>
      ) : null}

      {isOpen && !isDraft ? (
        <form className="grid gap-4 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end" onSubmit={recordPayment}>
          <Field label="Amount received (£)">
            <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </Field>
          <Field label="Date received">
            <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required />
          </Field>
          <Field label="Bank reference (optional)">
            <Input value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" disabled={busy !== null}>
            {busy === "payment" ? "Saving..." : "Record bank payment"}
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
