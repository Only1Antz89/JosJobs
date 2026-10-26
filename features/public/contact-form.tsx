"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_EVENT_TYPES, CONTACT_SERVICE_NEEDS, SITE_CONTACT } from "@/lib/site-content";
import { contactInquirySchema } from "@/lib/validation/schemas";

type ContactFormState = {
  name: string;
  email: string;
  eventType: string;
  expectedAttendance: string;
  serviceNeeds: string[];
  brief: string;
};

export function ContactForm() {
  const [form, setForm] = useState<ContactFormState>({
    name: "",
    email: "",
    eventType: "",
    expectedAttendance: "",
    serviceNeeds: [],
    brief: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [website, setWebsite] = useState("");

  const toggleServiceNeed = (value: string) => {
    setForm((current) => ({
      ...current,
      serviceNeeds: current.serviceNeeds.includes(value)
        ? current.serviceNeeds.filter((item) => item !== value)
        : [...current.serviceNeeds, value]
    }));
  };

  if (submitted) {
    return (
      <Card className="space-y-4">
        <Badge variant="success">Enquiry sent</Badge>
        <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-ink">
          Thanks, we&apos;ve received your brief.
        </h2>
        <p className="text-base leading-7 text-slate">
          The Athena Pro team will review it and reply to the email address you gave us.
        </p>
        <Button variant="secondary" onClick={() => setSubmitted(false)}>
          Submit another enquiry
        </Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" hint={errors.name}>
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Full name"
          />
        </Field>
        <Field label="Email" hint={errors.email}>
          <Input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="name@company.com"
          />
        </Field>
        <Field label="Event type" hint={errors.eventType}>
          <Select
            value={form.eventType}
            onChange={(event) => setForm((current) => ({ ...current, eventType: event.target.value }))}
          >
            <option value="">Select event type</option>
            {CONTACT_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Expected attendance" hint={errors.expectedAttendance}>
          <Input
            value={form.expectedAttendance}
            onChange={(event) =>
              setForm((current) => ({ ...current, expectedAttendance: event.target.value }))
            }
            placeholder="e.g. 12,000"
          />
        </Field>
      </div>

      <Field
        label="Service needs"
        hint={errors.serviceNeeds ?? "Choose the operating layer you need Athena Pro to cover."}
      >
        <div className="flex flex-wrap gap-3">
          {CONTACT_SERVICE_NEEDS.map((option) => {
            const active = form.serviceNeeds.includes(option);

            return (
              <button
                key={option}
                type="button"
                className={
                  active
                    ? "rounded-full border border-accent bg-accent px-4 py-2 text-sm font-medium text-ink"
                    : "rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate transition hover:border-white/20 hover:text-ink"
                }
                onClick={() => toggleServiceNeed(option)}
              >
                {option}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Event brief" hint={errors.brief ?? "Optional, but useful for venue, timing, and risk context."}>
        <Textarea
          value={form.brief}
          onChange={(event) => setForm((current) => ({ ...current, brief: event.target.value }))}
          placeholder="Outline the event environment, access pressure, technical complexity, or commercial concerns."
        />
      </Field>

      {/* Hidden from people; bots that fill it in are ignored by the server. */}
      <div aria-hidden="true" className="hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
      </div>

      {sendError ? (
        <p role="alert" className="text-sm text-red-400">
          {sendError}
        </p>
      ) : null}

      <Button
        disabled={sending}
        onClick={async () => {
          const parsed = contactInquirySchema.safeParse(form);

          if (!parsed.success) {
            const nextErrors = parsed.error.flatten().fieldErrors;
            setErrors({
              name: nextErrors.name?.[0] ?? "",
              email: nextErrors.email?.[0] ?? "",
              eventType: nextErrors.eventType?.[0] ?? "",
              expectedAttendance: nextErrors.expectedAttendance?.[0] ?? "",
              serviceNeeds: nextErrors.serviceNeeds?.[0] ?? "",
              brief: nextErrors.brief?.[0] ?? ""
            });
            return;
          }

          setErrors({});
          setSendError("");
          setSending(true);

          try {
            const response = await fetch("/api/contact", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...parsed.data, website })
            });
            const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

            if (!response.ok || !payload.ok) {
              setSendError(
                payload.error ?? `We couldn't send your enquiry. Please email ${SITE_CONTACT.supportEmail}.`
              );
              return;
            }

            setSubmitted(true);
          } catch {
            setSendError(`We couldn't send your enquiry. Please email ${SITE_CONTACT.supportEmail}.`);
          } finally {
            setSending(false);
          }
        }}
      >
        {sending ? "Sending..." : "Submit enquiry"}
      </Button>
    </Card>
  );
}
