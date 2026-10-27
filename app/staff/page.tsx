import type { Metadata } from "next";
import { StaffDirectory } from "@/features/public/staff-directory";
import { getPublicRankedStaff } from "@/lib/services/staffbook-service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Field team",
  description:
    "Meet Athena Pro's vetted field operators, ranked by delivery record, reliability and event experience.",
  path: "/staff"
});

// Refresh listings from Supabase at most once a minute instead of freezing them at build time.
export const revalidate = 60;

export default async function StaffPage() {
  const staff = await getPublicRankedStaff();
  return <StaffDirectory initialStaff={staff} />;
}
