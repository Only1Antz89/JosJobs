"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/utils";

type ClientInvoice = {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  balance: number;
  status: string;
  href: string;
};

const STATUS_TEXT: Record<string, string> = {
  sent: "Due",
  part_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue"
};

// Lists the company's invoices with links to view, print or pay them.
// Shows nothing until the first invoice exists.
export function ClientInvoicesCard() {
  const [invoices, setInvoices] = useState<ClientInvoice[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/invoices", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : { invoices: [] }))
      .then((payload: { invoices?: ClientInvoice[] }) => {
        if (!cancelled) setInvoices(payload.invoices ?? []);
      })
      .catch(() => {
        if (!cancelled) setInvoices([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!invoices || invoices.length === 0) {
    return null;
  }

  const outstanding = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);

  return (
    <Card className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Invoices</p>
          <h2 className="mt-3 text-2xl font-semibold text-ink">Billing</h2>
        </div>
        <p className="text-sm text-slate">Outstanding: {formatMoney(outstanding)}</p>
      </div>
      <ul className="mt-6 divide-y divide-white/10">
        {invoices.map((invoice) => (
          <li key={invoice.invoiceNumber} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium text-ink">{invoice.invoiceNumber}</p>
              <p className="text-slate">
                Issued {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={invoice.status === "overdue" ? "danger" : invoice.status === "paid" ? "neutral" : "accent"}>
                {STATUS_TEXT[invoice.status] ?? invoice.status}
              </Badge>
              <span className="text-ink">{formatMoney(invoice.balance > 0 ? invoice.balance : invoice.totalAmount)}</span>
              <Link className="underline underline-offset-4" href={invoice.href}>
                {invoice.balance > 0 ? "View and pay" : "View"}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
