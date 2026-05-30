# Alerting Runbook

SLAProof evaluates in-process metrics and exposes current alert state at
`/api/alerts`. Critical alert breaches return HTTP 503 so an external monitor can
page on the endpoint without parsing the response body.

## Surfaces

| Surface | Purpose | Auth posture |
|---|---|---|
| `/api/metrics` | Raw counters / histograms for operators. | Unauthenticated, like health. |
| `/api/alerts` | Evaluated alert state and thresholds. | Unauthenticated, like health and metrics. |
| `reportError` | Delivery path for alert notifications and runtime errors. | Server-side only. |

The unauthenticated posture is deliberate: these endpoints expose operational
counts and thresholds, not secrets or case payloads. The residual recon risk is
tracked in the production threat model.

## Alert Rules

Rules live in `lib/observability/alerts.ts`.

| Alert key | Default threshold | Level | Source metric |
|---|---:|---|---|
| `case_create_error_rate` | `0.05` (5%) | critical | `case_create_failed / (case_create_ok + case_create_failed)` |
| `latency_ms` | `2000` ms | warn | max of `case_create_ms` histogram |
| `failed_reads` | `5` | critical | `verifier_get_receipt_error` counter |

A value must be strictly greater than its threshold to alert. Zero case-create
requests produce an error rate of `0`, never `NaN`.

## Threshold Environment Variables

Set these server-side env vars to override defaults:

```bash
ALERT_ERROR_RATE_MAX=0.05
ALERT_LATENCY_MS_MAX=2000
ALERT_FAILED_READS_MAX=5
```

Invalid, blank, negative, or non-numeric values fall back to defaults.

## Checking Alert State

```bash
curl -fsS https://<app-host>/api/alerts
```

Healthy response:

```json
{
  "ok": true,
  "alerts": [],
  "evaluatedAt": "2026-05-30T00:00:00.000Z"
}
```

Warn-only response returns HTTP 200 with `ok: false`. Critical alerts return HTTP
503 with `ok: false`.

## Notification Flow

`notifyAlerts(alerts)` sends each alert through `reportError(new Error(...),
context)`. This reuses the existing error-reporting sinks:

- local structured logs;
- optional `ERROR_WEBHOOK_URL` remote webhook;
- optional Sentry-compatible sink when configured.

Alert context includes:

- `kind: "alert"`
- `alertKey`
- `level`
- `value`
- `threshold`

## External Monitor Setup

Configure your uptime or status monitor to check:

```text
GET /api/alerts
Expected HTTP status: 200
Page on: 503
Warn on body: ok=false with only warn alerts (optional)
```

A second monitor should continue checking `/api/health`, which covers app health
and database reachability in Postgres mode.

## Response Playbook

### `case_create_error_rate` critical

1. Check `/api/metrics` for `case_create_failed` and `case_create_ok`.
2. Review application logs by `x-request-id`.
3. Check recent deploys and env validation warnings.
4. If failures are storage-related, check `/api/health` database block and the
   Postgres provider status page.
5. If failures are validation-related, inspect recent client payload changes.

### `failed_reads` critical

1. Check GenLayer RPC health and `NEXT_PUBLIC_GENLAYER_RPC_URL`.
2. Confirm the configured contract address and network label.
3. Use the GenLayer deployment runbook to smoke-test read-back.
4. If the contract is reachable but receipts are missing, pause new pilot case
   finalization and preserve case ids for manual recovery.

### `latency_ms` warn

1. Check whether the latency spike correlates with case creation or storage.
2. Check Postgres provider metrics and app logs.
3. If using Vercel, inspect function logs and cold-start / region placement.
4. Escalate to critical only if latency is paired with case-create failures.

## On-call Rota Template

| Week | Primary | Secondary | Escalation |
|---|---|---|---|
| YYYY-W## | Name / contact | Name / contact | Maintainer / contact |
| YYYY-W## | Name / contact | Name / contact | Maintainer / contact |

Minimum expectations:

- Primary acknowledges critical alerts within the pilot SLA window.
- Secondary takes over if primary is unavailable.
- Escalation owns vendor/provider communication and customer-facing updates.
