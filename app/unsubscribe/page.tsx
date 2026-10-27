import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { getRuntimeMode } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Email preferences",
  description:
    "Choose which Athena Pro emails you receive.",
  path: "/unsubscribe",
  noIndex: true
});

async function getPreference(token: string) {
  if (!token || getRuntimeMode() !== "live") {
    return null;
  }

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("marketing_preferences")
    .select("newsletter_opt_in, offers_opt_in, product_updates_opt_in")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  return data ?? null;
}

export default async function UnsubscribePage({
  searchParams
}: {
  searchParams: { token?: string; status?: string };
}) {
  const status = searchParams.status ?? "";
  const token = searchParams.token ?? "";
  const preference = await getPreference(token);

  return (
    <main>
      <SiteHeader />
      <section className="flex min-h-[calc(100svh-72px)] items-center justify-center px-4 py-8 sm:min-h-[calc(100svh-80px)] sm:px-6 sm:py-12">
        <Card className="w-full max-w-xl space-y-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">Email preferences</p>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-ink sm:text-4xl">
            {status === "success" ? "You have been unsubscribed" : status === "updated" ? "Preferences updated" : "Manage Athena marketing emails"}
          </h1>
          <p className="text-sm text-slate">
            {status === "success"
              ? "You will no longer receive Athena Pro marketing email. Service and account emails may still be sent where required."
              : status === "updated"
                ? "Your Athena marketing preferences have been saved."
                : "Choose which Athena Pro marketing emails you want to receive. Transactional assignment, security, and account emails still send where required."}
          </p>

          {token && preference ? (
            <form action="/api/marketing/unsubscribe" method="post" className="space-y-4">
              <input type="hidden" name="token" value={token} />

              <label className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <Checkbox name="newsletterConsent" defaultChecked={Boolean(preference.newsletter_opt_in)} />
                <div>
                  <p className="font-medium text-ink">News and newsletters</p>
                  <p className="mt-1 text-sm text-slate">Athena bulletins, case studies, and service news.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <Checkbox name="offersConsent" defaultChecked={Boolean(preference.offers_opt_in)} />
                <div>
                  <p className="font-medium text-ink">Offers and promotions</p>
                  <p className="mt-1 text-sm text-slate">Commercial offers, launches, and campaign-led promotions.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <Checkbox name="productUpdatesConsent" defaultChecked={Boolean(preference.product_updates_opt_in)} />
                <div>
                  <p className="font-medium text-ink">Platform updates</p>
                  <p className="mt-1 text-sm text-slate">Non-essential product updates and feature announcements.</p>
                </div>
              </label>

              <div className="flex flex-wrap gap-3">
                <Button type="submit">Save preferences</Button>
                <Button type="submit" name="unsubscribeAll" value="true" variant="secondary">
                  Unsubscribe from all marketing
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-slate">This unsubscribe link is incomplete, expired, or no longer valid.</p>
          )}

          <Link href="/auth/login" className="inline-block">
            <Button variant="secondary">Return to Athena Pro</Button>
          </Link>
        </Card>
      </section>
    </main>
  );
}
