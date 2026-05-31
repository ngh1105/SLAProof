import { NextResponse } from "next/server";
import { snapshot } from "@/lib/observability/metrics";
import { evaluateAlerts, type Alert } from "@/lib/observability/alerts";

export const dynamic = "force-dynamic";

export type AlertsStatus = {
  ok: boolean;
  alerts: Alert[];
  evaluatedAt: string;
};

// Unauthenticated, like /api/health and /api/metrics: this surfaces only alert
// counts/levels/thresholds derived from evaluateAlerts — no secrets, no PII.
//
// Status convention mirrors /api/health's 503-on-failure: HTTP 503 when ANY
// alert is "critical" (user-facing data integrity), 200 otherwise. A "warn"
// alert (e.g. high latency — slow but still correct) is non-fatal: the body
// reports ok=false but the status stays 200. `ok` is true only when there are
// no alerts at all.
export async function GET() {
  const snap = snapshot();
  const alerts = evaluateAlerts(snap);
  const status: AlertsStatus = {
    ok: alerts.length === 0,
    alerts,
    evaluatedAt: snap.collectedAt,
  };

  const hasCritical = alerts.some((a) => a.level === "critical");
  return NextResponse.json(status, {
    status: hasCritical ? 503 : 200,
  });
}
