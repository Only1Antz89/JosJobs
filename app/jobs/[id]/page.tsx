import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JobDetail } from "@/features/public/job-detail";
import { pageMetadata } from "@/lib/seo";
import { getPublicJobs } from "@/lib/services/staffbook-service";

// Refresh listings from Supabase at most once a minute instead of freezing them at build time.
export const revalidate = 60;

// Shared by the page and its metadata so the jobs are only loaded once per request.
const findJob = cache(async (id: string) => {
  const jobs = await getPublicJobs();
  return jobs.find((entry) => entry.id === id) ?? null;
});

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const job = await findJob(params.id);

  if (!job) {
    return { title: "Job not found", robots: { index: false, follow: false } };
  }

  const where = job.event.location ? ` in ${job.event.location}` : "";
  const summary = job.description.trim().replace(/\s+/g, " ");

  return pageMetadata({
    title: `${job.title} at ${job.event.title}`,
    description:
      summary.length > 0
        ? summary.slice(0, 155)
        : `Apply for the ${job.title} role at ${job.event.title}${where} with Athena Pro.`,
    path: `/jobs/${job.id}`
  });
}

export default async function JobPage({ params }: { params: { id: string } }) {
  const job = await findJob(params.id);

  if (!job) {
    notFound();
  }

  return <JobDetail job={job} />;
}
