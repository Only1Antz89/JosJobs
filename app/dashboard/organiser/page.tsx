import type { Metadata } from "next";
import { OrganiserDashboard } from "@/features/organiser/organiser-dashboard";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Company workspace",
  description:
    "Manage your events, roles and applicants.",
  path: "/dashboard/organiser",
  noIndex: true
});

export default function OrganiserDashboardPage() {
  return <OrganiserDashboard />;
}
