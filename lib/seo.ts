import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { SITE_CONTACT } from "@/lib/site-content";

// The public domain used for canonical links, Open Graph URLs, the sitemap and robots.txt.
// Set NEXT_PUBLIC_SITE_URL on Netlify; otherwise the real domain from site content is used,
// never a netlify.app or preview address.
export function getSiteUrl() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || SITE_CONTACT.websiteUrl).trim();
  const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

type PageMetadataInput = {
  title?: string;
  description?: string;
  path: string;
  // Private pages (dashboards, sign-in, admin) should not appear in search results.
  noIndex?: boolean;
};

// A page that sets its own openGraph/twitter tags replaces the root ones, so the
// share images (app/opengraph-image.jpg, app/twitter-image.jpg) are listed again here.
const SHARE_IMAGE = { width: 1200, height: 630, alt: `${BRAND.plainName}: events, ticketing and tech` };

// Builds the per-page title, description, canonical URL and social tags.
export function pageMetadata({ title, description, path, noIndex }: PageMetadataInput): Metadata {
  const url = path === "/" ? "/" : path.replace(/\/+$/, "");
  const socialTitle = title ? `${title} | ${BRAND.plainName}` : BRAND.plainName;
  const socialDescription = description ?? BRAND.metadataDescription;

  return {
    ...(title ? { title } : {}),
    description: socialDescription,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: BRAND.plainName,
      locale: "en_GB",
      title: socialTitle,
      description: socialDescription,
      url,
      images: [{ url: "/opengraph-image.jpg", ...SHARE_IMAGE }]
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: socialDescription,
      images: [{ url: "/twitter-image.jpg", ...SHARE_IMAGE }]
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {})
  };
}
