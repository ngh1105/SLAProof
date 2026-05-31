import { describe, it, expect } from "vitest";
import type { MetricsSnapshot } from "@/lib/observability/metrics";
import {
  evaluateAlerts,
  resolveThresholds,
  type AlertThresholds,
} from "@/lib/observability/alerts";

// Helper: build a MetricsSnapshot with the real shape used by metrics.ts.
function buildSnapshot(
  counters: Record<string, number> = {},
  histograms: Record<
    string,
    { count: number; sum: number; min: number; max: number; avg: number }
  > = {},
  streaks: Record<string, number> = {},
): MetricsSnapshot {
  return {
    counters,
    histograms,
    streaks,
    collectedAt: new Date("2026-05-30T00:00:00.000Z").toISOString(),
  };
}

function hist(max: number, count = 1): {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
} {
  // For alerting we only read `max`; the rest is filled to keep the shape real.
  return { count, sum: max, min: 0, max, avg: count === 0 ? 0 : max / count };
}

const LOW_THRESHOLDS: AlertThresholds = {
  errorRateMax: 0.05,
  latencyMsMax: 2000,
  failedReadsMax: 5,
};

describe("evaluateAlerts", () => {
  it("returns [] when every metric is under threshold", () => {
    const snapshot = buildSnapshot(
      { case_create_ok: 100, case_create_failed: 2 },
      { case_create_ms: hist(1500) },
      { verifier_get_receipt_error_streak: 1 },
    );
    expect(evaluateAlerts(snapshot, LOW_THRESHOLDS)).toEqual([]);
  });

  it("flags error rate above max as a single critical alert", () => {
    // 10 failed / (90 ok + 10 failed) = 0.1 > 0.05
    const snapshot = buildSnapshot({ case_create_ok: 90, case_create_failed: 10 });
    const alerts = evaluateAlerts(snapshot, LOW_THRESHOLDS);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      key: "case_create_error_rate",
      level: "critical",
      value: 0.1,
      threshold: 0.05,
    });
    expect(typeof alerts[0].message).toBe("string");
  });

  it("flags request latency max above threshold as a warn alert", () => {
    const snapshot = buildSnapshot(
      { case_create_ok: 100 },
      { case_create_ms: hist(3500) },
    );
    const alerts = evaluateAlerts(snapshot, LOW_THRESHOLDS);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      key: "latency_ms",
      level: "warn",
      value: 3500,
      threshold: 2000,
    });
  });

  it("flags consecutive failed reads above threshold as a critical alert", () => {
    const snapshot = buildSnapshot(
      { case_create_ok: 100 },
      {},
      { verifier_get_receipt_error_streak: 9 },
    );
    const alerts = evaluateAlerts(snapshot, LOW_THRESHOLDS);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      key: "failed_reads",
      level: "critical",
      value: 9,
      threshold: 5,
    });
  });

  it("does NOT flag failed reads when the streak has reset (self-heal after recovery)", () => {
    // Lifetime errors were high, but a recent successful read reset the streak
    // to 0 — the alert must reflect current health, not lifetime totals.
    const snapshot = buildSnapshot(
      { case_create_ok: 100, verifier_get_receipt_error: 50 },
      {},
      { verifier_get_receipt_error_streak: 0 },
    );
    expect(evaluateAlerts(snapshot, LOW_THRESHOLDS)).toEqual([]);
  });

  it("does not divide by zero or alert on error rate when there are no requests", () => {
    const snapshot = buildSnapshot({}, {});
    const alerts = evaluateAlerts(snapshot, LOW_THRESHOLDS);
    expect(alerts).toEqual([]);
    // Zero successes AND zero failures → total 0 → guarded, no alert.
    const noRequests = buildSnapshot({ case_create_failed: 0 });
    expect(evaluateAlerts(noRequests, LOW_THRESHOLDS)).toEqual([]);
  });

  it("reports a finite 100% rate when there are failures but zero successes", () => {
    // 3 failed / (0 ok + 3 failed) = 1.0 — finite, and above the 5% max.
    const snapshot = buildSnapshot({ case_create_failed: 3 });
    const alerts = evaluateAlerts(snapshot, LOW_THRESHOLDS);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      key: "case_create_error_rate",
      level: "critical",
      value: 1,
      threshold: 0.05,
    });
  });

  it("can return multiple alerts at once", () => {
    const snapshot = buildSnapshot(
      { case_create_ok: 50, case_create_failed: 50 },
      { case_create_ms: hist(9000) },
      { verifier_get_receipt_error_streak: 20 },
    );
    const keys = evaluateAlerts(snapshot, LOW_THRESHOLDS).map((a) => a.key).sort();
    expect(keys).toEqual(["case_create_error_rate", "failed_reads", "latency_ms"]);
  });
});

describe("resolveThresholds", () => {
  it("returns documented defaults when env is empty", () => {
    expect(resolveThresholds({})).toEqual({
      errorRateMax: 0.05,
      latencyMsMax: 2000,
      failedReadsMax: 5,
    });
  });

  it("reads env overrides when present and numeric", () => {
    const env = {
      ALERT_ERROR_RATE_MAX: "0.2",
      ALERT_LATENCY_MS_MAX: "500",
      ALERT_FAILED_READS_MAX: "10",
    };
    expect(resolveThresholds(env)).toEqual({
      errorRateMax: 0.2,
      latencyMsMax: 500,
      failedReadsMax: 10,
    });
  });

  it("falls back to defaults on NaN or empty values", () => {
    const env = {
      ALERT_ERROR_RATE_MAX: "not-a-number",
      ALERT_LATENCY_MS_MAX: "",
      ALERT_FAILED_READS_MAX: "   ",
    };
    expect(resolveThresholds(env)).toEqual({
      errorRateMax: 0.05,
      latencyMsMax: 2000,
      failedReadsMax: 5,
    });
  });

  it("falls back to defaults on negative values (misconfiguration footgun)", () => {
    const env = {
      ALERT_ERROR_RATE_MAX: "-1",
      ALERT_LATENCY_MS_MAX: "-500",
      ALERT_FAILED_READS_MAX: "-3",
    };
    expect(resolveThresholds(env)).toEqual({
      errorRateMax: 0.05,
      latencyMsMax: 2000,
      failedReadsMax: 5,
    });
  });
});
