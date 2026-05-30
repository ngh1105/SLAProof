import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createPostgresCaseStore, getPool, closePool } from "@/lib/storage/case-store-postgres";
import type { SlaCase } from "@/lib/domain/types";

const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const sample: SlaCase = {
  id: "case-pg-int-001",
  title: "Integration case",
  providerName: "Test RPC",
  chain: "ethereum-mainnet",
  endpointLabel: "test",
  status: "ready",
  incidentWindow: { startUtc: "2026-05-22T10:00:00Z", endUtc: "2026-05-22T10:30:00Z" },
  incidentSummary: "test",
  slaTerms: { availabilityTarget: "99.9%", errorThreshold: "5%", latencyThreshold: "", exclusions: "", creditRule: "" },
  evidence: [],
  createdAt: "2026-05-22T10:00:00Z",
  updatedAt: "2026-05-22T10:00:00Z",
};

maybe("Postgres case store (integration)", () => {
  beforeAll(async () => {
    const pool = getPool(url);
    await pool.query(`create table if not exists cases (
      id text primary key, data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now())`);
    await pool.query("DELETE FROM cases WHERE id = $1", [sample.id]);
  });

  afterAll(async () => {
    const pool = getPool(url);
    await pool.query("DELETE FROM cases WHERE id = $1", [sample.id]);
    await closePool();
  });

  it("saves and reads back a case", async () => {
    const store = createPostgresCaseStore(url);
    await store.save(sample);
    const read = await store.get(sample.id);
    expect(read?.title).toBe("Integration case");
  });

  it("updates an existing case on save (upsert)", async () => {
    const store = createPostgresCaseStore(url);
    await store.save({ ...sample, title: "Updated" });
    const read = await store.get(sample.id);
    expect(read?.title).toBe("Updated");
  });

  it("lists the saved case", async () => {
    const store = createPostgresCaseStore(url);
    const all = await store.list();
    expect(all.some((c) => c.id === sample.id)).toBe(true);
  });

  it("returns undefined for an unknown case", async () => {
    const store = createPostgresCaseStore(url);
    expect(await store.get("nope-not-real")).toBeUndefined();
  });
});
