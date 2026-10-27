import type { Metadata } from "next";
import { LandingPage } from "@/features/public/landing-page";
import { getPublicHighlights } from "@/lib/services/staffbook-service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/"
});

// Refresh listings from Supabase at most once a minute instead of freezing them at build time.
export const revalidate = 60;

export default async function HomePage() {
  const data = await getPublicHighlights();
  return <LandingPage data={data} />;
}
