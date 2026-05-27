import { afterEach, describe, expect, it, vi } from "vitest";
import { reportError, setErrorSink, resetErrorSink } from "@/lib/observability/error-reporter";
import { setLogSink, resetLogSink, type LogEntry } from "@/lib/observability/logger";

describe("error-reporter", () => {
  afterEach(() => {
    resetErrorSink();
    resetLogSink();
  });

  it("default sink routes to structured logger as error", () => {
    const logs: LogEntry[] = [];
    setLogSink((e) => logs.push(e));
    reportError(new Error("boom"), { caseId: "c1" });
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("error");
    expect(logs[0].message).toBe("boom");
    expect(logs[0].context).toMatchObject({ name: "Error", caseId: "c1" });
  });

  it("normalizes non-Error throws", () => {
    const logs: LogEntry[] = [];
    setLogSink((e) => logs.push(e));
    reportError("string failure");
    expect(logs[0].message).toBe("string failure");
  });

  it("uses injected sink", () => {
    const calls: Array<[Error, unknown]> = [];
    setErrorSink((err, ctx) => calls.push([err, ctx]));
    reportError(new Error("boom"), { foo: "bar" });
    expect(calls).toHaveLength(1);
    expect(calls[0][0].message).toBe("boom");
    expect(calls[0][1]).toEqual({ foo: "bar" });
  });

  it("swallows sink failures", () => {
    setErrorSink(() => {
      throw new Error("sink broken");
    });
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(() => reportError(new Error("boom"))).not.toThrow();
    expect(stderr).toHaveBeenCalled();
    stderr.mockRestore();
  });
});

describe("error-reporter redaction", () => {
  afterEach(() => {
    resetErrorSink();
    resetLogSink();
  });

  it("redacts sensitive keys before reaching the sink", () => {
    const calls: Array<{ context: unknown }> = [];
    setErrorSink((_err, context) => calls.push({ context }));
    reportError(new Error("boom"), {
      caseId: "c1",
      authorization: "Bearer abc",
      api_key: "sk_test_xyz",
    });
    expect(calls[0].context).toMatchObject({
      caseId: "c1",
      authorization: "[REDACTED]",
      api_key: "[REDACTED]",
    });
  });

  it("recurses into nested context objects", () => {
    const calls: Array<{ context: unknown }> = [];
    setErrorSink((_err, context) => calls.push({ context }));
    reportError(new Error("boom"), { meta: { token: "secret123", okay: 42 } });
    const meta = (calls[0].context as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta.token).toBe("[REDACTED]");
    expect(meta.okay).toBe(42);
  });
});
