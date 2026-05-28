import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRemoteErrorSink,
  configureErrorTrackingFromEnv,
} from "@/lib/observability/error-tracking";
import {
  reportError,
  resetErrorSink,
  setErrorSink,
} from "@/lib/observability/error-reporter";

describe("buildRemoteErrorSink", () => {
  afterEach(() => resetErrorSink());

  it("posts a JSON payload to the configured URL", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response("", { status: 204 });
    }) as unknown as typeof fetch;

    const sink = buildRemoteErrorSink({
      url: "https://example.test/ingest",
      service: "slaproof-test",
      environment: "test",
      fetchImpl,
    });
    setErrorSink(sink);

    reportError(new Error("boom"), { phase: "unit" });

    // sink fires asynchronously; flush microtasks
    await new Promise((r) => setImmediate(r));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://example.test/ingest");
    const body = JSON.parse(String(calls[0].init?.body ?? "{}"));
    expect(body.service).toBe("slaproof-test");
    expect(body.error.message).toBe("boom");
    expect(body.context).toMatchObject({ phase: "unit" });
  });

  it("never throws when remote fetch rejects", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const sink = buildRemoteErrorSink({
      url: "https://example.test/x",
      fetchImpl,
    });
    setErrorSink(sink);

    expect(() => reportError(new Error("boom"))).not.toThrow();
    await new Promise((r) => setImmediate(r));
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("redacts context credentials before posting", async () => {
    const calls: Array<{ body: unknown }> = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push({ body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response("", { status: 204 });
    }) as unknown as typeof fetch;
    setErrorSink(
      buildRemoteErrorSink({ url: "https://example.test/x", fetchImpl }),
    );

    reportError(new Error("boom"), {
      caseId: "c1",
      authorization: "secret-bearer",
      api_key: "sk_live_abc",
    });
    await new Promise((r) => setImmediate(r));

    const body = calls[0].body as { context: Record<string, unknown> };
    expect(body.context.caseId).toBe("c1");
    expect(body.context.authorization).toBe("[REDACTED]");
    expect(body.context.api_key).toBe("[REDACTED]");
  });
});

describe("configureErrorTrackingFromEnv", () => {
  afterEach(() => resetErrorSink());

  it("returns false and leaves default sink when no URL configured", () => {
    expect(configureErrorTrackingFromEnv({} as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("returns true when ERROR_WEBHOOK_URL is set", () => {
    expect(
      configureErrorTrackingFromEnv({
        ERROR_WEBHOOK_URL: "https://example.test/x",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("falls back to SENTRY_DSN when no webhook URL", () => {
    expect(
      configureErrorTrackingFromEnv({
        SENTRY_DSN: "https://abc@sentry.io/1",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});
