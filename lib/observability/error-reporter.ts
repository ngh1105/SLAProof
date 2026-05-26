// Error reporter abstraction. Default sink only logs via the structured
// logger. When SENTRY_DSN (or any other shipper) is configured, swap the
// sink at startup with `setErrorSink()`.
//
// Keeps the surface tiny so we can replace the implementation without
// touching call sites: `reportError(err, context)` is the only API.

import { log } from "./logger";

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
  try {
    activeSink(normalized, context);
  } catch {
    // Reporter must never throw — fall back to console as a last resort.
    process.stderr.write(
      `error_reporter_sink_failed: ${normalized.message}\n`,
    );
  }
}
