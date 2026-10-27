import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin-login", "/dashboard", "/events", "/api", "/auth/forgot-password", "/auth/reset-password", "/unsubscribe", "/invoices"]
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`
  };
}
