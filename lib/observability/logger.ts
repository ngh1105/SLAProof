// Structured JSON logger. Writes one JSON object per line so log aggregators
// can parse without regex. Replaces ad-hoc console.error / console.log calls.
//
// In production, swap the sink to ship to OpenTelemetry / Datadog / similar.

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
};

export type LogSink = (entry: LogEntry) => void;

const defaultSink: LogSink = (entry) => {
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
};

let activeSink: LogSink = defaultSink;

export function setLogSink(sink: LogSink): void {
  activeSink = sink;
}

export function resetLogSink(): void {
  activeSink = defaultSink;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  activeSink({
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  });
}

export const log = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
