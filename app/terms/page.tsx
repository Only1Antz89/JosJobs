import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/layout/marketing-page-shell";
import { Card } from "@/components/ui/card";
import { TERMS_CONTENT } from "@/lib/site-content";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms and Conditions",
  description:
    "The core terms governing use of the Athena Pro website and services.",
  path: "/terms"
});

export default function TermsPage() {
  return (
    <MarketingPageShell
      eyebrow="Terms and Conditions"
      title="Terms and Conditions"
      intro="Last updated: April 5, 2026. These terms govern the use of Athena Pro and its website and services."
    >
      <div className="grid gap-6">
        {TERMS_CONTENT.map((section) => (
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
