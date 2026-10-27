import { BRAND } from "@/lib/brand";

// Branded placeholder shown while a server-rendered page loads.
export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-line/40 border-t-accent" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">{BRAND.name}</p>
        <span className="sr-only">Loading</span>
      </div>
    </main>
  );
}
