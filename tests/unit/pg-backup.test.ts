import { describe, expect, it } from "vitest";
import { dumpCases, restoreCases, type BackupSnapshot } from "@/lib/storage/pg-backup";
import type { CaseStore } from "@/lib/storage/case-store-interface";
import type { SlaCase } from "@/lib/domain/types";

function makeCase(id: string, overrides: Partial<SlaCase> = {}): SlaCase {
  return {
    id,
    title: `Case ${id}`,
    providerName: "Test RPC",
    chain: "ethereum-mainnet",
    endpointLabel: "test",
    status: "ready",
    incidentWindow: { startUtc: "2026-05-22T10:00:00Z", endUtc: "2026-05-22T10:30:00Z" },
    incidentSummary: "test incident",
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
    ...overrides,
  };
}

/** Minimal in-memory CaseStore for exercising the backup core. */
function createFakeStore(seed: SlaCase[] = []): CaseStore {
  const cases = new Map<string, SlaCase>();
  for (const c of seed) cases.set(c.id, c);
  return {
    list: async () => Array.from(cases.values()),
    get: async (caseId: string) => cases.get(caseId),
    save: async (slaCase: SlaCase) => {
      cases.set(slaCase.id, slaCase);
    },
  };
}

describe("dumpCases", () => {
  it("snapshots every case from the store", async () => {
    const a = makeCase("case-a");
    const b = makeCase("case-b");
    const store = createFakeStore([a, b]);

    const snapshot = await dumpCases(store);

    expect(snapshot.count).toBe(2);
    expect(snapshot.store).toBe("postgres");
    expect(snapshot.rows).toEqual([a, b]);
    expect(typeof snapshot.takenAt).toBe("string");
    expect(Number.isNaN(Date.parse(snapshot.takenAt))).toBe(false);
  });

  it("produces an empty snapshot for an empty store", async () => {
    const snapshot = await dumpCases(createFakeStore());
    expect(snapshot.count).toBe(0);
    expect(snapshot.rows).toEqual([]);
    expect(snapshot.store).toBe("postgres");
  });
});

describe("restoreCases", () => {
  it("upserts every row into an empty store and returns the count", async () => {
    const a = makeCase("case-a");
    const b = makeCase("case-b");
    const snapshot: BackupSnapshot = {
      takenAt: "2026-05-30T00:00:00.000Z",
      store: "postgres",
      count: 2,
      rows: [a, b],
    };
    const store = createFakeStore();

    const restored = await restoreCases(store, snapshot);

    expect(restored).toBe(2);
    expect(await store.list()).toEqual([a, b]);
    expect(await store.get("case-a")).toEqual(a);
    expect(await store.get("case-b")).toEqual(b);
  });

  it("round-trips a dumped snapshot", async () => {
    const source = createFakeStore([makeCase("case-a"), makeCase("case-b")]);
    const snapshot = await dumpCases(source);

    const target = createFakeStore();
    const restored = await restoreCases(target, snapshot);

    expect(restored).toBe(2);
    expect(await target.list()).toEqual(await source.list());
  });

  it("throws when the snapshot has no rows array", async () => {
    const store = createFakeStore();
    const bad = { takenAt: "x", store: "postgres", count: 0 } as unknown as BackupSnapshot;
    await expect(restoreCases(store, bad)).rejects.toThrow();
  });

  it("throws when rows is not an array", async () => {
    const store = createFakeStore();
    const bad = {
      takenAt: "x",
      store: "postgres",
      count: 0,
      rows: "nope",
    } as unknown as BackupSnapshot;
    await expect(restoreCases(store, bad)).rejects.toThrow();
  });

  it("rejects with the row index when a row is not a valid case, before any save", async () => {
    const store = createFakeStore();
    const bad = {
      takenAt: "x",
      store: "postgres",
      count: 2,
      rows: [makeCase("case-a"), { nope: true }],
    } as unknown as BackupSnapshot;
    await expect(restoreCases(store, bad)).rejects.toThrow(/rows\[1\]/);
    // validation runs up front, so nothing should have been persisted
    expect(await store.list()).toEqual([]);
  });
});
