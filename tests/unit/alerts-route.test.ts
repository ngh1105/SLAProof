import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as alertsGet } from "@/app/api/alerts/route";
import { increment, observe, resetMetrics } from "@/lib/observability/metrics";

// Drive REAL metrics (no mocks) so the route exercises the same
// snapshot() → evaluateAlerts() path it runs in production. Values are pushed
// well past the default thresholds so the outcome is deterministic regardless
// of any ALERT_* env overrides.
describe("/api/alerts", () => {
  beforeEach(() => resetMetrics());
  afterEach(() => resetMetrics());

  it("returns 200 + ok=true + empty alerts when healthy", async () => {
    // Plenty of successful case creations, fast, no failed reads → no alerts.
    increment("case_create_ok", 100);
    observe("case_create_ms", 150);

    const res = await alertsGet();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alerts).toEqual([]);
    expect(body.evaluatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns 503 + ok=false when a critical alert is present", async () => {
    // 50 failed / 50 = 100% error rate → critical error-rate alert.
    increment("case_create_failed", 50);

    const res = await alertsGet();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.alerts.length).toBeGreaterThan(0);
    expect(
      body.alerts.some(
        (a: { key: string; level: string }) =>
          a.level === "critical" && a.key === "case_create_error_rate",
      ),
    ).toBe(true);
  });

  it("returns 200 + ok=false when only a warn alert is present", async () => {
    // High latency is a warn (non-fatal): slow but still serving correct
    // results. No error-rate or failed-read breaches → no critical alert.
    increment("case_create_ok", 100);
    observe("case_create_ms", 9000);

    const res = await alertsGet();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.alerts).toHaveLength(1);
    expect(body.alerts[0]).toMatchObject({ key: "latency_ms", level: "warn" });
  });
});
