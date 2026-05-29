import { describe, expect, it, afterEach } from "vitest";
import { getCaseStore, resetCaseStore } from "@/lib/storage/case-store-factory";
import { fileCaseStore } from "@/lib/storage/case-store";

afterEach(() => {
  resetCaseStore();
  delete process.env.SLAPROOF_STORE;
  delete process.env.DATABASE_URL;
});

describe("getCaseStore", () => {
  it("defaults to the file store when SLAPROOF_STORE is unset", () => {
    delete process.env.SLAPROOF_STORE;
    resetCaseStore();
    expect(getCaseStore()).toBe(fileCaseStore);
  });

  it("returns the file store when SLAPROOF_STORE=file", () => {
    process.env.SLAPROOF_STORE = "file";
    resetCaseStore();
    expect(getCaseStore()).toBe(fileCaseStore);
  });

  it("returns a Postgres store (not the file store) when SLAPROOF_STORE=postgres", () => {
    process.env.SLAPROOF_STORE = "postgres";
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    resetCaseStore();
    const store = getCaseStore();
    expect(store).not.toBe(fileCaseStore);
    expect(typeof store.list).toBe("function");
  });
});
