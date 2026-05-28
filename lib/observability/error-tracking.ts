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
      .then((res) => {
        // Treat non-2xx as a delivery failure so silent provider rejections
        // (auth, quota, schema) still surface in the local logs.
        if (res && typeof res.status === "number" && res.status >= 400) {
          log.warn("error_reporter_remote_status", {
            status: res.status,
          });
        }
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
  // `??` only treats null/undefined as missing. An empty `ERROR_WEBHOOK_URL`
  // (typical when the var is declared but unset) would short-circuit the
  // SENTRY_DSN fallback. Trim + truthy check picks the first non-empty value.
  const url =
    env.ERROR_WEBHOOK_URL?.trim() ||
    env.SENTRY_DSN?.trim() ||
    "";
  if (!url) return false;
  const sink = buildRemoteErrorSink({
    url,
    environment:
      env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV || undefined,
    release:
      env.SLAPROOF_RELEASE?.trim() ||
      env.NEXT_PUBLIC_SLAPROOF_COMMIT_SHA?.trim() ||
      undefined,
  });
  setErrorSink(sink);
  log.info("error_tracking_enabled", {
    target: maskSinkUrl(url),
  });
  return true;
}

// Strip userinfo, replace path segments that look like opaque tokens, and
// drop the query string entirely before logging the sink target. DSN
// passwords (https://user:pass@host), in-path webhook tokens
// (https://hooks.slack.com/services/T00/B00/XXXSECRET), and query-string
// secrets (?token=***) all stop landing in plaintext logs.
function maskSinkUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const auth = u.username ? "***@" : "";
    const safePath = redactPathSegments(u.pathname);
    return `${u.protocol}//${auth}${u.host}${safePath}${u.search ? "?<redacted>" : ""}`;
  } catch {
    return raw
      .replace(/(?<=:\/\/)[^@/]+@/, "***@")
      .replace(/\?.*$/, "?<redacted>");
  }
}

function redactPathSegments(pathname: string): string {
  if (!pathname || pathname === "/") return pathname;
  return pathname
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      // Anything that looks like an opaque high-entropy token (>=16 chars,
      // alnum / dash / underscore / dot only) is treated as a secret.
      return /^[A-Za-z0-9._-]{16,}$/.test(seg) ? "***" : seg;
    })
    .join("/");
}
