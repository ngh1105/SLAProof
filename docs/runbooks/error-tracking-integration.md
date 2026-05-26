# Error Tracking Integration

The pilot ships with a structured logger and an `error-reporter` abstraction
(`lib/observability/error-reporter.ts`). The default sink routes errors to
the logger as `level=error` JSON lines. Production deploys should swap the
sink for a managed error tracker (Sentry, Datadog, Honeycomb, etc.).

## Where errors are reported

Calls to `reportError(err, context)` exist at:

- `app/cases/new/actions.ts` — storage failure inside `createCaseAction`
  with `phase: "saveDemoCase"` and `caseId`.
- `lib/verifier/genlayer-adapter.ts` — `RPC_FAILED` and `UNKNOWN` paths in
  `submitCase` and `waitForFinalization`.
- `app/error.tsx` — every uncaught render error with `phase:
  "app_error_boundary"` and the Next.js error digest.

`USER_REJECTED`, `EXECUTION_FAILED`, and `MISSING_RECEIPT` are not reported
because they're expected outcomes (user closed wallet, contract reverted on
bad input, receipt not yet finalized).

## Swapping the sink — Sentry example

```ts
// instrumentation.ts (or a server-only bootstrap module)
import * as Sentry from "@sentry/nextjs";
import { setErrorSink } from "@/lib/observability/error-reporter";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});

setErrorSink((err, context) => {
  Sentry.captureException(err, { extra: context });
});
```

The default sink (logger output) keeps running unless `setErrorSink` is
called. There is no need to disable the logger — both can co-exist.

## Adding a different tracker

Any function with the signature `(err: Error, context?: Record<string,
unknown>) => void` works. Examples:

- **Datadog APM:** `tracer.dogstatsd.event(...)` plus `span.setTag("error",
  true)` inside a no-op span.
- **Honeycomb:** `libhoney.sendNow({ ...context, error: err.message,
  stack: err.stack })`.
- **Slack/webhook:** `fetch(WEBHOOK_URL, { method: "POST", body: JSON
  ... })` for low-volume critical alerts.

## Required context fields

Conventions used inside the app — keep these stable so dashboards can
group cleanly:

| Key | Meaning |
|---|---|
| `phase` | High-level operation (`saveDemoCase`, `submitCase`, `waitForFinalization`, `app_error_boundary`) |
| `code` | Verifier error code if applicable (`RPC_FAILED`, `UNKNOWN`) |
| `caseId` | SLA case id when relevant |
| `txHash` | GenLayer tx hash when relevant |
| `digest` | Next.js error digest (only in `app/error.tsx`) |

## PII / secrets

`reportError` does **not** redact context. Callers must not pass:

- Pasted evidence excerpts (use the case id instead)
- Wallet private keys or session cookies
- Pilot tokens

The audit log redacts sensitive keys automatically (PR #75); the error
reporter does not. If you bring this in line, add the same `redactDetails`
treatment in `error-reporter.ts` and update tests.

## Testing the swap

`tests/unit/error-reporter.test.ts` injects an in-memory sink. After wiring
a real tracker, run:

```bash
node -e "import('./lib/observability/error-reporter.js').then(m => m.reportError(new Error('boot test'), { phase: 'manual' }))"
```

Then verify the event lands in your tracker. Roll back via `resetErrorSink()`
if it fires.

## Configuration

Recommended env vars (not yet enforced by the app — add them to
`env-validation.ts` once the team picks a provider):

| Var | Notes |
|---|---|
| `SENTRY_DSN` | Sentry project endpoint |
| `SENTRY_ENVIRONMENT` | Override `NODE_ENV` if needed |
| `DATADOG_API_KEY` | Datadog ingestion |
| `HONEYCOMB_WRITE_KEY` | Honeycomb ingestion |

## Related

- `lib/observability/error-reporter.ts`
- `lib/observability/logger.ts`
- `tests/unit/error-reporter.test.ts`
- `docs/security/threat-model-pilot.md` — T1 / T8 redaction guidance
