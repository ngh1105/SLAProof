import { describe, expect, it } from "vitest";
import { createInMemoryCaseStore } from "@/lib/storage/case-store-memory";
import type { SlaCase } from "@/lib/domain/types";

const sample: SlaCase = {
  id: "case-rpc-test-001",
  title: "Test case",
  providerName: "Test RPC",
  chain: "ethereum-mainnet",
  endpointLabel: "test",
  status: "ready",
  incidentWindow: { startUtc: "2026-05-22T10:00:00Z", endUtc: "2026-05-22T10:30:00Z" },
  incidentSummary: "test",
  slaTerms: {
    availabilityTarget: "99.9% monthly",
    errorThreshold: "5%",
    latencyThreshold: "",
    exclusions: "",
    creditRule: "",
  },
  evidence: [],
  createdAt: "2026-05-22T10:00:00Z",
  updatedAt: "2026-05-22T10:00:00Z",
};

describe("createInMemoryCaseStore", () => {
  it("starts empty by default", async () => {
    const store = createInMemoryCaseStore();
    expect(await store.list()).toEqual([]);
    expect(await store.get("missing")).toBeUndefined();
  });

  it("seeds initial cases", async () => {
    const store = createInMemoryCaseStore([sample]);
    expect(await store.list()).toHaveLength(1);
    expect((await store.get(sample.id))?.title).toBe("Test case");
  });

  it("save inserts new case", async () => {
    const store = createInMemoryCaseStore();
    await store.save(sample);
    expect(await store.list()).toHaveLength(1);
    expect(await store.get(sample.id)).toBeDefined();
  });

  it("save updates existing case", async () => {
    const store = createInMemoryCaseStore([sample]);
    await store.save({ ...sample, title: "Updated" });
    expect(await store.list()).toHaveLength(1);
    expect((await store.get(sample.id))?.title).toBe("Updated");
  });
});
