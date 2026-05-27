// Error reporter abstraction. Default sink only logs via the structured
// logger. When SENTRY_DSN (or any other shipper) is configured, swap the
// sink at startup with `setErrorSink()`.
//
// Keeps the surface tiny so we can replace the implementation without
// touching call sites: `reportError(err, context)` is the only API.
//
// Context is run through the same redactor as the audit log so a future
// caller cannot accidentally ship credentials to an external tracker
// (closes P5 in the production threat model).

import { log } from "./logger";
import { redactDetails } from "./redact";

export type ErrorContext = Record<string, unknown>;

export type ErrorSink = (err: Error, context?: ErrorContext) => void;

const defaultSink: ErrorSink = (err, context) => {
  log.error(err.message, {
    name: err.name,
    stack: err.stack,
    ...context,
  });
};

let activeSink: ErrorSink = defaultSink;

export function setErrorSink(sink: ErrorSink): void {
  activeSink = sink;
}

export function resetErrorSink(): void {
  activeSink = defaultSink;
}

export function reportError(err: unknown, context?: ErrorContext): void {
  const normalized = err instanceof Error ? err : new Error(String(err));
  const safeContext = redactDetails(context);
  try {
    activeSink(normalized, safeContext);
  } catch {
    // Reporter must never throw — fall back to console as a last resort.
    process.stderr.write(
      `error_reporter_sink_failed: ${normalized.message}\n`,
    );
  }
}
