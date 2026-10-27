import type { Metadata } from "next";
import { StaffDashboard } from "@/features/staff/staff-dashboard";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Field team workspace",
  description:
    "Your shifts, applications and availability.",
  path: "/dashboard/staff",
  noIndex: true
});

export default function StaffDashboardPage() {
  return <StaffDashboard />;
}
