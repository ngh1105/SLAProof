import { afterEach, describe, expect, it } from "vitest";
import { GET as healthGet } from "@/app/api/health/route";
import { GET as metricsGet } from "@/app/api/metrics/route";
import { GET as versionGet } from "@/app/api/version/route";
import { increment, observe, resetMetrics } from "@/lib/observability/metrics";

describe("/api/health", () => {
  it("returns ok+200 in mock mode (default)", async () => {
    const prev = process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER;
    delete process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER;
    try {
      const res = await healthGet();
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body.verifier.mode).toBe("mock");
      expect(typeof body.uptime).toBe("number");
      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      if (prev !== undefined) process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER = prev;
    }
  });

  it("returns degraded+503 when genlayer mode lacks env", async () => {
    const env = process.env;
    process.env = {
      ...env,
      NEXT_PUBLIC_SLAPROOF_VERIFIER: "genlayer",
      NEXT_PUBLIC_GENLAYER_RPC_URL: "",
      NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS: "",
    };
    try {
      const res = await healthGet();
      const body = await res.json();
      expect(res.status).toBe(503);
      expect(body.status).toBe("degraded");
      expect(body.verifier.issues.length).toBeGreaterThan(0);
    } finally {
      process.env = env;
    }
  });
});

describe("/api/metrics", () => {
  afterEach(() => resetMetrics());

  it("returns counter + histogram snapshot", async () => {
    increment("api_test_counter");
    observe("api_test_hist", 42);
    const res = await metricsGet();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.counters.api_test_counter).toBe(1);
    expect(body.histograms.api_test_hist).toMatchObject({ count: 1, min: 42, max: 42 });
  });
});

describe("/api/version", () => {
  it("includes app, node, receipt versions, and contract block", async () => {
    const res = await versionGet();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.app).toMatch(/^\d/);
    expect(body.node).toMatch(/^v/);
    expect(body.receipt.current).toBe("slaproof.receipt.v0");
    expect(Array.isArray(body.receipt.supported)).toBe(true);
    expect(body.contract).toHaveProperty("address");
    expect(body.contract).toHaveProperty("network");
  });
});
