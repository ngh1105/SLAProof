// Pure, side-effect-free alert evaluator over a metrics snapshot.
//
// No timers, no network, no I/O — snapshot in, alert list out — so it is
// trivially unit-testable. See docs/plans/2026-05-30-production-readiness-gate-design.md
// (decisions B and C) for the threshold rationale.
//
// Metric-key mapping (real keys discovered in lib/ + app/, NOT invented):
//   - There is no single "total requests" counter. The coherent request flow
//     with a paired success/failure counter is case creation, so request total
//     is derived as `case_create_ok + case_create_failed` and the error rate is
//     `case_create_failed / (case_create_ok + case_create_failed)`. When that
//     denominator is 0 the rate is 0 (no divide-by-zero, never NaN).
//   - Request latency histogram: `case_create_ms` (observe(...) in
//     app/cases/new/actions.ts). We alert on its `max`.
//   - Failed contract/receipt reads: consecutive-failure streak
//     `verifier_get_receipt_error_streak` (snapshot.streaks). It increments in
//     the catch branch of getReceipt() and RESETS to 0 on the next successful
//     read, so the alert reflects whether reads are failing *right now* and
//     self-heals once the RPC recovers — rather than a lifetime total that
//     would latch 503 until the next redeploy.
//
// Level choice (documented per spec): error-rate and failed-read breaches are
// "critical" — they mean users are getting errors / receipts can't be read,
// which is user-facing data integrity. A latency breach is "warn" — the system
// is slow but still serving correct results.

import type { MetricsSnapshot } from "@/lib/observability/metrics";

export type AlertLevel = "warn" | "critical";

export type Alert = {
  key: string;
  level: AlertLevel;
  value: number;
  threshold: number;
  message: string;
};

export type AlertThresholds = {
  errorRateMax: number;
  latencyMsMax: number;
  failedReadsMax: number;
};

// Real metric keys this evaluator reads.
const REQUEST_OK_KEY = "case_create_ok";
const REQUEST_FAILED_KEY = "case_create_failed";
const LATENCY_HISTOGRAM_KEY = "case_create_ms";
const FAILED_READS_STREAK_KEY = "verifier_get_receipt_error_streak";

const DEFAULT_THRESHOLDS: AlertThresholds = {
  errorRateMax: 0.05,
  latencyMsMax: 2000,
  failedReadsMax: 5,
};

// Parse an env value to a finite, non-negative number, falling back to
// `fallback` on missing / empty / whitespace / NaN / negative. A negative
// threshold would make its alert fire on essentially every snapshot, so we
// treat it as a misconfiguration and fall back. Never returns NaN.
function numberOrDefault(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function resolveThresholds(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AlertThresholds {
  return {
    errorRateMax: numberOrDefault(env.ALERT_ERROR_RATE_MAX, DEFAULT_THRESHOLDS.errorRateMax),
    latencyMsMax: numberOrDefault(env.ALERT_LATENCY_MS_MAX, DEFAULT_THRESHOLDS.latencyMsMax),
    failedReadsMax: numberOrDefault(env.ALERT_FAILED_READS_MAX, DEFAULT_THRESHOLDS.failedReadsMax),
  };
}

export function evaluateAlerts(
  snapshot: MetricsSnapshot,
  thresholds: AlertThresholds = resolveThresholds(),
): Alert[] {
  const alerts: Alert[] = [];
  // Breach policy: a value alerts only when STRICTLY above its threshold;
  // a value exactly at the threshold does not alert.

  const ok = snapshot.counters[REQUEST_OK_KEY] ?? 0;
  const failed = snapshot.counters[REQUEST_FAILED_KEY] ?? 0;
  const totalRequests = ok + failed;

  // Error rate — guarded against divide-by-zero. Zero requests → rate 0.
  if (totalRequests > 0) {
    const errorRate = failed / totalRequests;
    if (errorRate > thresholds.errorRateMax) {
      alerts.push({
        key: "case_create_error_rate",
        level: "critical",
        value: errorRate,
        threshold: thresholds.errorRateMax,
        message:
          `Case-creation error rate ${(errorRate * 100).toFixed(1)}% exceeds max ` +
          `${(thresholds.errorRateMax * 100).toFixed(1)}% ` +
          `(${failed}/${totalRequests} case-creation requests failed).`,
      });
    }
  }

  // Request latency — alert on the histogram max.
  const latency = snapshot.histograms[LATENCY_HISTOGRAM_KEY];
  if (latency && latency.max > thresholds.latencyMsMax) {
    alerts.push({
      key: "latency_ms",
      level: "warn",
      value: latency.max,
      threshold: thresholds.latencyMsMax,
      message:
        `Request latency max ${latency.max}ms exceeds ` +
        `${thresholds.latencyMsMax}ms.`,
    });
  }

  // Consecutive failed receipt reads. Resets to 0 on any successful read, so a
  // recovered RPC clears this alert without waiting for a redeploy.
  const failedReads = snapshot.streaks[FAILED_READS_STREAK_KEY] ?? 0;
  if (failedReads > thresholds.failedReadsMax) {
    alerts.push({
      key: "failed_reads",
      level: "critical",
      value: failedReads,
      threshold: thresholds.failedReadsMax,
      message:
        `Consecutive failed receipt reads ${failedReads} exceeds max ` +
        `${thresholds.failedReadsMax}.`,
    });
  }

  return alerts;
}
