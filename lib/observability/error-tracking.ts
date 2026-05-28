// Optional remote error sink that activates when an `ERROR_WEBHOOK_URL`
// (or compatible) environment variable is set. Keeps the pilot free of
// hard dependencies on a specific provider while still satisfying the
// "App has error tracking" readiness gate.
//
// The sink fires `fetch` with a small JSON payload — Sentry's "envelope"
// HTTP API, Datadog Events, and Slack incoming webhooks can all consume
// the same shape (or an adapter is one wrapper away).
//
// `setErrorSink` is idempotent: re-registering simply replaces the
// active sink. The default logger sink is the fallback when this module
// is not initialized.

import { setErrorSink, type ErrorSink } from "./error-reporter";
import { log } from "./logger";

export type RemoteErrorSinkConfig = {
  url: string;
  service?: string;
  environment?: string;
  release?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 2_500;

export function buildRemoteErrorSink(config: RemoteErrorSinkConfig): ErrorSink {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("buildRemoteErrorSink requires a global fetch implementation");
  }
  const timeout = Math.max(250, config.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  return (err, context) => {
    const payload = {
      timestamp: new Date().toISOString(),
      service: config.service ?? "slaproof",
      environment: config.environment ?? process.env.NODE_ENV ?? "unknown",
      release: config.release,
      level: "error",
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      context: context ?? {},
    };

    // Fire-and-forget: never block the call site, never throw.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);
    fetchImpl(config.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ac.signal,
    })
      .catch((sinkErr) => {
        log.warn("error_reporter_remote_failed", {
          message: sinkErr instanceof Error ? sinkErr.message : String(sinkErr),
        });
      })
      .finally(() => clearTimeout(timer));
  };
}

export function configureErrorTrackingFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const url = env.ERROR_WEBHOOK_URL ?? env.SENTRY_DSN ?? "";
  if (!url) return false;
  const sink = buildRemoteErrorSink({
    url,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    release: env.SLAPROOF_RELEASE ?? env.NEXT_PUBLIC_SLAPROOF_COMMIT_SHA,
  });
  setErrorSink(sink);
  log.info("error_tracking_enabled", {
    target: url.replace(/(?<=:\/\/)[^@/]+@/, "***@"),
  });
  return true;
}
