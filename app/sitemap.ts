import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";
import { getPublicJobs } from "@/lib/services/staffbook-service";

export const revalidate = 3600;

const STATIC_PATHS = ["/", "/services", "/about", "/contact", "/jobs", "/staff", "/auth/signup", "/auth/login", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const jobs = await getPublicJobs();

  return [
    ...STATIC_PATHS.map((path) => ({ url: `${base}${path === "/" ? "" : path}` })),
    ...jobs.map((job) => ({ url: `${base}/jobs/${job.id}`, lastModified: job.updatedAt }))
  ];
}
