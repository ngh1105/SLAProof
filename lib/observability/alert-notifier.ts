// Routes alert breaches into the existing error-reporter sink. There is no
// new transport here by design (see decision B in
// docs/plans/2026-05-30-production-readiness-gate-design.md): reportError is
// the single delivery API, so alerts ride the same redaction + shipper path
// as every other reported error. Silent when healthy — an empty alert list
// produces zero calls.

import type { Alert } from "./alerts";
import { reportError } from "./error-reporter";

export function notifyAlerts(
  alerts: Alert[],
  report: typeof reportError = reportError,
): void {
  for (const alert of alerts) {
    report(new Error(alert.message), {
      kind: "alert",
      alertKey: alert.key,
      level: alert.level,
      value: alert.value,
      threshold: alert.threshold,
    });
  }
}
