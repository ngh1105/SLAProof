"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RefreshReceiptButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  function onClick() {
    startTransition(() => {
      router.refresh();
      setLastRefreshed(new Date().toLocaleTimeString());
    });
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button className="ghost-button" type="button" onClick={onClick} disabled={isPending}>
        {isPending ? "Refreshing…" : "Refresh receipt"}
      </button>
      {lastRefreshed ? (
        <span style={{ color: "var(--muted)", fontSize: 12 }}>Last: {lastRefreshed}</span>
      ) : null}
    </div>
  );
}
