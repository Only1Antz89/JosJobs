import { StaffDirectory } from "@/features/public/staff-directory";
import { getPublicRankedStaff } from "@/lib/services/staffbook-service";

// Refresh listings from Supabase at most once a minute instead of freezing them at build time.
export const revalidate = 60;

export default async function StaffPage() {
  const staff = await getPublicRankedStaff();
  return <StaffDirectory initialStaff={staff} />;
}
