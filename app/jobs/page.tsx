import { JobsBrowser } from "@/features/public/jobs-browser";
import { getPublicJobs } from "@/lib/services/staffbook-service";

// Refresh listings from Supabase at most once a minute instead of freezing them at build time.
export const revalidate = 60;

export default async function JobsPage() {
  const jobs = await getPublicJobs();
  return <JobsBrowser initialJobs={jobs} />;
}
