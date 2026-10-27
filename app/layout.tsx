import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import "@/app/globals.css";
import { DeployRefresh } from "@/components/layout/deploy-refresh";
import { BRAND } from "@/lib/brand";
import { getSiteUrl } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${BRAND.plainName} | Event ticketing, staffing and operations`,
    template: `%s | ${BRAND.plainName}`
  },
  description: BRAND.metadataDescription,
  applicationName: BRAND.plainName,
  openGraph: {
    type: "website",
    siteName: BRAND.plainName,
    locale: "en_GB",
    title: BRAND.plainName,
    description: BRAND.metadataDescription
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.plainName,
    description: BRAND.metadataDescription
  }
};

const themeScript = `
  try {
    var theme = window.localStorage.getItem("josjobs-theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    }
  } catch (error) {}
`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${montserrat.variable} font-sans text-ink antialiased`}>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <DeployRefresh />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
