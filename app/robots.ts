import type { MetadataRoute } from "next";
import { SITE_CONTACT } from "@/lib/site-content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin-login", "/dashboard", "/events", "/api", "/auth", "/unsubscribe", "/invoices"]
    },
    sitemap: `${SITE_CONTACT.websiteUrl}/sitemap.xml`
  };
}
