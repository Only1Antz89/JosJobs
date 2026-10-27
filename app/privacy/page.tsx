import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/layout/marketing-page-shell";
import { Card } from "@/components/ui/card";
import { PRIVACY_CONTENT } from "@/lib/site-content";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How Athena Pro collects, uses, stores, and protects personal data.",
  path: "/privacy"
});

export default function PrivacyPage() {
  return (
    <MarketingPageShell
      eyebrow="Privacy Policy"
      title="Privacy Policy"
      intro="Last updated: April 5, 2026. This policy explains how Athena Pro collects, uses, stores, and protects personal data."
    >
      <div className="grid gap-6">
        {PRIVACY_CONTENT.map((section) => (
          <Card key={section.title} className="space-y-4">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-ink">{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="text-base leading-7 text-slate">
                {paragraph}
              </p>
            ))}
            {section.bullets ? (
              <ul className="space-y-3 text-base leading-7 text-slate">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>• {bullet}</li>
                ))}
              </ul>
            ) : null}
          </Card>
        ))}
      </div>
    </MarketingPageShell>
  );
}
