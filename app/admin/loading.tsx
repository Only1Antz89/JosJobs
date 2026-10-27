import { LoadingPanel } from "@/components/ui/loading-panel";

// Keeps the admin sidebar and header in place and shows a skeleton while the page's data loads.
export default function AdminLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
      <LoadingPanel label="Loading the latest data" />
      <LoadingPanel label="Loading the latest data" />
    </div>
  );
}
