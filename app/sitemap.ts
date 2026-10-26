import type { MetadataRoute } from "next";
import { SITE_CONTACT } from "@/lib/site-content";
import { getPublicJobs } from "@/lib/services/staffbook-service";

export const revalidate = 3600;

const STATIC_PATHS = ["/", "/services", "/about", "/contact", "/jobs", "/staff", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_CONTACT.websiteUrl;
  const jobs = await getPublicJobs();

  return [
    ...STATIC_PATHS.map((path) => ({ url: `${base}${path === "/" ? "" : path}` })),
    ...jobs.map((job) => ({ url: `${base}/jobs/${job.id}`, lastModified: job.updatedAt }))
  ];
}
