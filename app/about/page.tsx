import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { ABOUT_CONTENT, SITE_CONTACT } from "@/lib/site-content";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "Learn how Athena Pro combines strategic thinking, technical precision, and event operations.",
  path: "/about"
});

const ABOUT_IMAGES = [
  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80"
] as const;

export default function AboutPage() {
  return (
    <main className="overflow-x-hidden">
      <SiteHeader />

      <section className="theme-dark relative isolate overflow-hidden bg-hero-grid">
        <div className="absolute inset-0">
          <Image
            src={ABOUT_IMAGES[0]}
            alt="Athena Pro team in a focused planning session."
            fill
            sizes="100vw"
            className="object-cover opacity-24"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,18,19,0.55),rgba(17,18,19,0.95))]" />
        </div>
        <PageContainer className="relative z-10 py-12 sm:py-16 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(320px,0.9fr)] lg:items-end">
            <div className="scroll-reveal max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate">
                {ABOUT_CONTENT.eyebrow}
              </p>
              <h1 className="text-balance mt-5 font-display text-4xl font-semibold tracking-[-0.07em] text-ink sm:text-5xl md:text-7xl">
                {ABOUT_CONTENT.title}
              </h1>
            </div>
            <div className="scroll-reveal-right max-w-2xl text-sm leading-7 text-slate sm:text-base sm:leading-8 md:text-lg">
              {ABOUT_CONTENT.intro.map((paragraph) => (
                <p key={paragraph} className="mt-5 first:mt-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="py-20 md:py-28">
        <PageContainer className="grid gap-10 lg:grid-cols-[minmax(260px,0.56fr)_minmax(0,1fr)] lg:items-start">
          <div className="scroll-reveal space-y-5 lg:sticky lg:top-28">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Operating belief</p>
            <h2 className="text-balance font-display text-3xl font-semibold tracking-[-0.06em] text-ink sm:text-4xl md:text-5xl">
              Precision only matters when it survives contact with the crowd.
            </h2>
            <p className="max-w-md text-base leading-8 text-slate">
              Athena Pro is designed around that idea. The model combines systems thinking, field discipline,
              and commercial awareness into one quieter way of running live work.
            </p>
          </div>

          <div className="space-y-12">
            {ABOUT_CONTENT.sections.map((section, index) => (
              <div
                key={section.title}
                className="grid gap-6 border-t border-line/60 pt-8 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,0.88fr)_minmax(240px,0.74fr)] md:items-start"
              >
                <div className={index % 2 === 0 ? "scroll-reveal-left" : "scroll-reveal"}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
                    0{index + 1}
                  </p>
                  <h3 className="mt-4 font-display text-3xl font-semibold tracking-[-0.05em] text-ink md:text-4xl">
                    {section.title}
                  </h3>
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph} className="mt-4 max-w-2xl text-base leading-8 text-slate">
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets ? (
                    <div className="mt-6 space-y-3">
                      {section.bullets.map((bullet) => (
                        <div key={bullet} className="border-t border-line/60 pt-3 text-sm leading-7 text-slate first:border-t-0 first:pt-0">
                          {bullet}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className={index % 2 === 0 ? "scroll-reveal-scale" : "scroll-reveal-right"}>
                  <div className="relative h-[240px] overflow-hidden rounded-[34px] border border-line/60 bg-black/20 sm:h-[280px] md:h-[320px]">
                    <Image
                      src={ABOUT_IMAGES[(index + 1) % ABOUT_IMAGES.length]}
                      alt={`${section.title} at Athena Pro.`}
                      fill
                      sizes="(min-width: 768px) 40vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>

      <section className="pb-20 md:pb-28">
        <PageContainer className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(280px,0.68fr)] lg:items-center">
          <div className="scroll-reveal-scale relative h-[320px] overflow-hidden rounded-[40px] border border-line/60 sm:h-[420px] md:h-[520px]">
            <Image
              src={ABOUT_IMAGES[4]}
              alt="Athena Pro leadership and operations team in discussion."
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="space-y-6">
            <div className="scroll-reveal">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">What companies get</p>
              <h2 className="text-balance mt-4 font-display text-3xl font-semibold tracking-[-0.06em] text-ink sm:text-4xl md:text-5xl">
                A measured team, a cleaner signal chain, and fewer operational surprises.
              </h2>
            </div>
            <div className="scroll-reveal-right space-y-4 text-base leading-8 text-slate">
              <p>
                The platform is only one part of the offer. The rest is judgement: who gets deployed, what gets
                escalated, what gets reported, and how commercial risk is kept visible while the event is still
                moving.
              </p>
              <p>
                That is the Athena shape of the work: sparse on the surface, rigorous underneath.
              </p>
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="pb-20">
        <PageContainer>
          <div className="theme-dark scroll-reveal-scale rounded-[40px] border border-line/60 bg-[linear-gradient(135deg,rgba(24,27,31,0.88),rgba(32,37,43,0.94))] p-8 md:p-12">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Contact</p>
                <h2 className="text-balance mt-4 font-display text-3xl font-semibold tracking-[-0.06em] text-ink sm:text-4xl md:text-5xl">
                  Bring Athena Pro in when the live environment needs more control.
                </h2>
                <div className="mt-6 space-y-2 text-base leading-8 text-slate">
                  <p>Email: {SITE_CONTACT.supportEmail}</p>
                  <p>Website: {SITE_CONTACT.websiteUrl}</p>
                  <p>Registered office: {SITE_CONTACT.registeredOffice}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/contact">
                  <Button className="w-full gap-2 sm:w-auto">
                    Contact Athena Pro <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/services">
                  <Button variant="secondary" className="w-full sm:w-auto">
                    View services
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      <SiteFooter />
    </main>
  );
}
