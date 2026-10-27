import type { Metadata } from "next";
import { JobsBrowser } from "@/features/public/jobs-browser";
import { getPublicJobs } from "@/lib/services/staffbook-service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Job board",
  description:
    "Browse open event shifts and roles across ticketing, access control and frontline operations, and apply with your Athena Pro field team profile.",
  path: "/jobs"
});

// Refresh listings from Supabase at most once a minute instead of freezing them at build time.
export const revalidate = 60;

export default async function JobsPage() {
  const jobs = await getPublicJobs();
  return <JobsBrowser initialJobs={jobs} />;
}
