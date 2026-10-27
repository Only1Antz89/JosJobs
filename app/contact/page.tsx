import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/layout/marketing-page-shell";
import { Card } from "@/components/ui/card";
import { ContactForm } from "@/features/public/contact-form";
import { SITE_CONTACT } from "@/lib/site-content";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Start an Athena Pro enquiry for ticketing support, event staffing, or commercial management.",
  path: "/contact"
});

export default function ContactPage() {
  return (
    <MarketingPageShell
      eyebrow="Contact"
      title="Minimal intake. Clear operational context."
      intro="Share the event type, expected attendance, and service needs. Athena Pro will use that to scope the right technical and field support layer."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
        <ContactForm />
        <Card className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
              Direct contact
            </p>
            <p className="mt-3 text-base leading-7 text-slate">
              For confidential commercial conversations or existing operational matters, contact Athena Pro
              directly.
            </p>
          </div>
          <div className="space-y-3 text-sm text-slate">
            <p>{SITE_CONTACT.supportEmail}</p>
            <p>{SITE_CONTACT.websiteUrl}</p>
            <p>{SITE_CONTACT.registeredOffice}</p>
          </div>
          <div className="image-slot rounded-[26px] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
              Intake fields
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-mist">
              <li>• Event Type</li>
              <li>• Expected Attendance</li>
              <li>• Service Needs</li>
              <li>• Optional event brief</li>
            </ul>
          </div>
        </Card>
      </div>
    </MarketingPageShell>
  );
}
