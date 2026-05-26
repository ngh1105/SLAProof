import { afterEach, describe, expect, it } from "vitest";
import { log, setLogSink, resetLogSink, type LogEntry } from "@/lib/observability/logger";

describe("logger", () => {
  afterEach(() => resetLogSink());

  it("emits info with timestamp + message", () => {
    const entries: LogEntry[] = [];
    setLogSink((e) => entries.push(e));
    log.info("case_created", { caseId: "c1" });
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("info");
    expect(entries[0].message).toBe("case_created");
    expect(entries[0].context).toEqual({ caseId: "c1" });
    expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("supports all four levels", () => {
    const entries: LogEntry[] = [];
    setLogSink((e) => entries.push(e));
    log.debug("a");
    log.info("b");
    log.warn("c");
    log.error("d");
    expect(entries.map((e) => e.level)).toEqual(["debug", "info", "warn", "error"]);
  });

  it("resetLogSink restores default", () => {
    const entries: LogEntry[] = [];
    setLogSink((e) => entries.push(e));
    log.info("captured");
    resetLogSink();
    log.info("not captured");
    expect(entries).toHaveLength(1);
  });
});
