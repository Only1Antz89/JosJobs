"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

// Shown when a page fails to render. The root layout (header styles, fonts) stays in place.
export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="panel-shell w-full max-w-lg rounded-[32px] p-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate">{BRAND.name}</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] text-ink">
          This page didn&apos;t load
        </h1>
        <p className="mt-4 text-sm text-slate">
          Something went wrong on our side. Try again, and if it keeps happening, contact us and quote
          {error.digest ? ` reference ${error.digest}` : " the page you were on"}.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link
            href="/"
            className="inline-flex rounded-full px-5 py-3 text-sm font-semibold text-ink ring-1 ring-line/70"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
