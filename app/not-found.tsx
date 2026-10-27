import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false }
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="panel-shell w-full max-w-lg rounded-[32px] p-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">{BRAND.name}</p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-ink">Page not found</h1>
        <p className="mt-4 text-base text-slate">
          This page may have moved, or the link may be mistyped. Head back to the home page, or browse open roles.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex rounded-full bg-mist px-5 py-3 text-sm font-semibold text-canvas"
          >
            Back to home
          </Link>
          <Link
            href="/jobs"
            className="inline-flex rounded-full px-5 py-3 text-sm font-semibold text-ink ring-1 ring-line/70"
          >
            Browse jobs
          </Link>
        </div>
      </div>
    </main>
  );
}
