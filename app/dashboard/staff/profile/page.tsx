import type { Metadata } from "next";
import { OperatorProfileWorkspace } from "@/features/staff/operator-profile-workspace";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Your profile",
  description:
    "Update your field team profile, skills and availability.",
  path: "/dashboard/staff/profile",
  noIndex: true
});

export default function StaffProfilePage() {
  return <OperatorProfileWorkspace />;
}
