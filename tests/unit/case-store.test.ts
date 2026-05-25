import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let originalCwd: string;
let tmpRoot: string;

async function freshImport() {
  vi.resetModules();
  return await import("@/lib/storage/case-store");
}

beforeEach(() => {
  originalCwd = process.cwd();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "slaproof-store-"));
  fs.mkdirSync(path.join(tmpRoot, "lib", "storage"), { recursive: true });
  process.chdir(tmpRoot);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("case-store saveDemoCase", () => {
  it("throws when the underlying file write fails", async () => {
    const store = await freshImport();
    const slaCase = store.getDemoCases()[0];
    const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("disk full");
    });

    expect(() => store.saveDemoCase({ ...slaCase, id: "case-rpc-new-001" })).toThrow(
      /disk full|Failed to save SLA case/i,
    );

    writeSpy.mockRestore();
  });

  it("persists a new case so it can be read back", async () => {
    const store = await freshImport();
    const seed = store.getDemoCases()[0];
    const created = { ...seed, id: "case-rpc-roundtrip-001", title: "Roundtrip" };

    store.saveDemoCase(created);

    const reread = (await freshImport()).getDemoCase("case-rpc-roundtrip-001");
    expect(reread?.title).toBe("Roundtrip");
  });
});

describe("case-store getDemoCases", () => {
  it("throws when the database file is corrupted instead of falling back to seed data", async () => {
    const store = await freshImport();
    store.getDemoCases(); // ensures the file exists with valid seed data

    const dbPath = path.join(tmpRoot, "lib", "storage", "db.json");
    fs.writeFileSync(dbPath, "{ this is not valid json", "utf-8");

    const fresh = await freshImport();
    expect(() => fresh.getDemoCases()).toThrow();
  });

  it("does not silently overwrite real data with seed data when read fails mid-save", async () => {
    const store = await freshImport();
    const seed = store.getDemoCases()[0];
    store.saveDemoCase({ ...seed, id: "user-case-001", title: "User typed this" });

    const dbPath = path.join(tmpRoot, "lib", "storage", "db.json");
    fs.writeFileSync(dbPath, "broken", "utf-8");

    const fresh = await freshImport();
    expect(() =>
      fresh.saveDemoCase({ ...seed, id: "user-case-002", title: "Another user case" }),
    ).toThrow();

    // The DB file must NOT have been overwritten with seed data + the new case.
    const onDisk = fs.readFileSync(dbPath, "utf-8");
    expect(onDisk).not.toContain("Another user case");
  });
});
