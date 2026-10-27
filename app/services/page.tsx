import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { SERVICE_PILLARS } from "@/lib/site-content";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Services",
  description:
    "Athena Pro services across ticketing technology, onsite personnel, and commercial event management.",
  path: "/services"
});

const SERVICE_IMAGES = [
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1497366412874-3415097a27e7?auto=format&fit=crop&w=1600&q=80"
] as const;

export default function ServicesPage() {
  return (
    <main className="overflow-x-hidden">
      <SiteHeader />

      <section className="theme-dark relative isolate overflow-hidden bg-hero-grid">
        <div className="absolute inset-0">
          <Image
            src={SERVICE_IMAGES[0]}
            alt="Athena Pro team coordinating live event service delivery."
            fill
            sizes="100vw"
            className="object-cover opacity-24"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,18,19,0.48),rgba(17,18,19,0.94))]" />
        </div>
        <PageContainer className="relative z-10 py-12 sm:py-16 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(320px,0.94fr)] lg:items-end">
            <div className="scroll-reveal max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate">Services</p>
              <h1 className="text-balance mt-5 font-display text-4xl font-semibold tracking-[-0.07em] text-ink sm:text-5xl md:text-7xl">
                Technical authority at the gate. Disciplined execution on the ground.
              </h1>
            </div>
            <div className="scroll-reveal-right max-w-2xl text-sm leading-7 text-slate sm:text-base sm:leading-8 md:text-lg">
              Athena Pro is structured around three operating layers: ticketing and technology, field personnel
              and supervision, and commercial management where event delivery carries financial risk.
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="py-20 md:py-28">
        <PageContainer className="grid gap-10 lg:grid-cols-[minmax(260px,0.52fr)_minmax(0,1fr)] lg:items-start">
          <div className="scroll-reveal space-y-5 lg:sticky lg:top-28">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Service frame</p>
            <h2 className="text-balance font-display text-3xl font-semibold tracking-[-0.06em] text-ink sm:text-4xl md:text-5xl">
              Three layers. One operating standard.
            </h2>
            <p className="max-w-md text-base leading-8 text-slate">
              Each service line is designed to feel minimal from the outside and highly controlled underneath.
              The point is tighter coordination, not more visible complexity.
            </p>
          </div>

          <div className="space-y-14">
            {SERVICE_PILLARS.map((pillar, index) => (
              <div
                key={pillar.key}
                className="grid gap-7 border-t border-line/60 pt-8 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,0.9fr)_minmax(260px,0.78fr)] md:items-start"
              >
                <div className={index % 2 === 0 ? "scroll-reveal-left" : "scroll-reveal"}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">
                      {pillar.ratio}
                    </p>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate">0{index + 1}</p>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.05em] text-ink md:text-4xl">
                    {pillar.title}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-8 text-slate">{pillar.summary}</p>
                  <div className="mt-6 space-y-3">
                    {pillar.bullets.map((bullet) => (
                      <div
                        key={bullet}
                        className="border-t border-line/60 pt-3 text-sm leading-7 text-slate first:border-t-0 first:pt-0"
                      >
                        {bullet}
                      </div>
                    ))}
                  </div>
                </div>

                <div className={index % 2 === 0 ? "scroll-reveal-scale" : "scroll-reveal-right"}>
                  <div className="relative h-[240px] overflow-hidden rounded-[34px] border border-line/60 bg-black/20 sm:h-[300px] md:h-[340px]">
                    <Image
                      src={SERVICE_IMAGES[index + 1]}
                      alt={`${pillar.title} in action.`}
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
        <PageContainer className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)] lg:items-center">
          <div className="scroll-reveal-scale relative h-[320px] overflow-hidden rounded-[40px] border border-line/60 sm:h-[420px] md:h-[520px]">
            <Image
              src={SERVICE_IMAGES[4]}
              alt="Black professionals managing premium event operations."
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="space-y-6">
            <div className="scroll-reveal">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Delivery note</p>
              <h2 className="text-balance mt-4 font-display text-3xl font-semibold tracking-[-0.06em] text-ink sm:text-4xl md:text-5xl">
                The point is not more moving parts. The point is tighter control.
              </h2>
            </div>
            <div className="scroll-reveal-right space-y-4 text-base leading-8 text-slate">
              <p>
                Athena Pro is designed to prevent operational gaps between ticketing systems, field personnel,
                and commercial decision-making.
              </p>
              <p>
                The platform exists to keep those layers aligned under pressure while the client experience stays
                composed and minimal.
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Next step</p>
                <h2 className="text-balance mt-4 font-display text-3xl font-semibold tracking-[-0.06em] text-ink sm:text-4xl md:text-5xl">
                  Bring Athena Pro in when the technical layer and the live floor need to move as one.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate">
                  Start with a commercial conversation, a delivery review, or a scoped support plan for the next
                  event cycle.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/contact">
                  <Button className="w-full gap-2 sm:w-auto">
                    Start an enquiry <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/about">
                  <Button variant="secondary" className="w-full sm:w-auto">
                    About Athena Pro
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
