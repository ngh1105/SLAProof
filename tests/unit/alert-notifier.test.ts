import { describe, expect, it, vi } from "vitest";
import { notifyAlerts } from "@/lib/observability/alert-notifier";
import type { Alert } from "@/lib/observability/alerts";

describe("alert-notifier", () => {
  it("routes each alert through the report sink as an Error with alert context", () => {
    const report = vi.fn();
    const alerts: Alert[] = [
      {
        key: "case_create_error_rate",
        level: "critical",
        value: 0.2,
        threshold: 0.05,
        message: "Case-creation error rate too high.",
      },
      {
        key: "latency_ms",
        level: "warn",
        value: 3000,
        threshold: 2000,
        message: "Request latency too high.",
      },
    ];

    notifyAlerts(alerts, report);

    expect(report).toHaveBeenCalledTimes(2);

    for (const [index, alert] of alerts.entries()) {
      const [err, context] = report.mock.calls[index];
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe(alert.message);
      expect(context).toEqual({
        kind: "alert",
        alertKey: alert.key,
        level: alert.level,
        value: alert.value,
        threshold: alert.threshold,
      });
    }
  });

  it("never calls report for an empty alert list", () => {
    const report = vi.fn();
    notifyAlerts([], report);
    expect(report).not.toHaveBeenCalled();
  });
});
