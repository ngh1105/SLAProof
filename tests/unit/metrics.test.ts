import { afterEach, describe, expect, it } from "vitest";
import { increment, observe, snapshot, resetMetrics } from "@/lib/observability/metrics";

describe("metrics", () => {
  afterEach(() => resetMetrics());

  it("increment counts and aggregates", () => {
    increment("case_created");
    increment("case_created");
    increment("case_created", 3);
    expect(snapshot().counters.case_created).toBe(5);
  });

  it("observe builds histogram with min/max/avg", () => {
    observe("submit_ms", 100);
    observe("submit_ms", 200);
    observe("submit_ms", 300);
    const h = snapshot().histograms.submit_ms;
    expect(h.count).toBe(3);
    expect(h.sum).toBe(600);
    expect(h.min).toBe(100);
    expect(h.max).toBe(300);
    expect(h.avg).toBe(200);
  });

  it("snapshot includes ISO timestamp", () => {
    increment("noop");
    expect(snapshot().collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("resetMetrics clears state", () => {
    increment("x");
    resetMetrics();
    expect(snapshot().counters).toEqual({});
    expect(snapshot().histograms).toEqual({});
  });
});
