"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pilotLoginAction } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await pilotLoginAction(token);
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.replace("/");
  }

  return (
    <main className="page" style={{ maxWidth: 480 }}>
      <section className="panel">
        <h1 style={{ fontSize: 22 }}>Pilot access</h1>
        <p className="lede" style={{ fontSize: 14 }}>
          Enter the pilot token shared with your operator team.
        </p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            type="password"
            className="input"
            placeholder="pilot token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoFocus
            required
          />
          {error ? (
            <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>
          ) : null}
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Verifying..." : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
