import { Card } from "@/components/ui/card";

export function LoadingPanel({ label = "Loading your workspace" }: { label?: string }) {
  return (
    <Card className="animate-pulse">
      <div className="h-4 w-28 rounded-full bg-white/10" />
      <div className="mt-4 h-8 w-2/3 rounded-full bg-white/10" />
      <div className="mt-3 h-4 w-full rounded-full bg-white/6" />
      <div className="mt-2 h-4 w-3/4 rounded-full bg-white/6" />
      <p className="mt-6 text-sm text-slate">{label}</p>
    </Card>
  );
}
