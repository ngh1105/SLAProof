"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportError } from "@/lib/observability/error-reporter";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { phase: "app_error_boundary", digest: error.digest });
  }, [error]);

  return (
    <main className="page" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center", display: "grid", gap: 16, maxWidth: 600 }}>
        <p className="eyebrow" style={{ color: "var(--danger)" }}>500</p>
        <h1>Something went wrong</h1>
        <p className="lede" style={{ margin: "0 auto" }}>
          The app caught an unexpected error. The team has been notified via the
          configured error sink. You can retry or return to the queue.
        </p>
        {error.digest ? (
          <p className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            ref: {error.digest}
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="button" onClick={reset}>Retry</button>
          <Link className="ghost-button" href="/">Back to queue</Link>
        </div>
      </div>
    </main>
  );
}
