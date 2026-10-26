import { notFound } from "next/navigation";
import { JobDetail } from "@/features/public/job-detail";
import { getPublicJobs } from "@/lib/services/staffbook-service";

// Refresh listings from Supabase at most once a minute instead of freezing them at build time.
export const revalidate = 60;

export default async function JobPage({ params }: { params: { id: string } }) {
  const jobs = await getPublicJobs();
  const job = jobs.find((entry) => entry.id === params.id);

  if (!job) {
    notFound();
  }

  return <JobDetail job={job} />;
}
