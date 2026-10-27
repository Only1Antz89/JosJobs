import type { Metadata } from "next";
import { StaffJobsBoard } from "@/features/staff/staff-jobs-board";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Available shifts",
  description:
    "Find and apply for shifts that match your profile.",
  path: "/dashboard/staff/jobs",
  noIndex: true
});

export default function StaffJobsBoardPage() {
  return <StaffJobsBoard />;
}
