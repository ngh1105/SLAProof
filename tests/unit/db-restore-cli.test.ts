import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "node:fs";
// The pure helpers are imported and tested directly. The main() tests below
// drive the real control flow with the deferred db/store imports mocked, so no
// real db, network, or snapshot file is ever touched. The mocked paths resolve
// to the same files the script dynamically imports, so vitest intercepts them.
vi.mock("../../lib/storage/pg-backup.ts", () => ({
  restoreCases: vi.fn(async () => 0),
}));
vi.mock("../../lib/storage/case-store-factory.ts", () => ({
  getCaseStore: vi.fn(),
}));
vi.mock("../../lib/storage/case-store-postgres.ts", () => ({
  closePool: vi.fn(async () => {}),
}));
// @ts-expect-error - db-restore.mjs is a plain ESM script with no .d.ts and allowJs is off, so TS cannot resolve its types; the exports are exercised at runtime by vitest.
import { parsePath, shouldSkip, overwriteDecision, main, EXIT_BAD_ARGS, EXIT_OVERWRITE_GUARD } from "../../scripts/db-restore.mjs";

describe("parsePath", () => {
  it("returns null when no path arg is present", () => {
    expect(parsePath([])).toBeNull();
    expect(parsePath(["--force"])).toBeNull();
  });

  it("returns the first non-flag arg as the snapshot path", () => {
    expect(parsePath(["snapshot.json"])).toBe("snapshot.json");
    expect(parsePath([".data/pg-backups/x.json"])).toBe(
      ".data/pg-backups/x.json",
    );
  });

  it("ignores flags like --force when finding the path", () => {
    expect(parsePath(["--force", "snapshot.json"])).toBe("snapshot.json");
    expect(parsePath(["snapshot.json", "--force"])).toBe("snapshot.json");
  });
});

describe("EXIT_BAD_ARGS", () => {
  it("is the documented exit code for a missing path argument", () => {
    expect(EXIT_BAD_ARGS).toBe(2);
  });
});

describe("EXIT_OVERWRITE_GUARD", () => {
  it("is the documented exit code for a tripped overwrite guard", () => {
    expect(EXIT_OVERWRITE_GUARD).toBe(3);
  });
});

describe("shouldSkip", () => {
  it("skips when the store is not postgres", () => {
    expect(shouldSkip({})).toBe(true);
    expect(shouldSkip({ SLAPROOF_STORE: "file" })).toBe(true);
    expect(shouldSkip({ SLAPROOF_STORE: "sqlite" })).toBe(true);
  });

  it("runs (does not skip) when the store is postgres", () => {
    expect(shouldSkip({ SLAPROOF_STORE: "postgres" })).toBe(false);
  });

  it("is case-insensitive about the store mode", () => {
    expect(shouldSkip({ SLAPROOF_STORE: "POSTGRES" })).toBe(false);
    expect(shouldSkip({ SLAPROOF_STORE: "FILE" })).toBe(true);
  });
});

describe("overwriteDecision", () => {
  it("blocks restore into a non-empty table without --force", () => {
    expect(overwriteDecision({ existingCount: 1, force: false })).toBe(
      "blocked",
    );
    expect(overwriteDecision({ existingCount: 42, force: false })).toBe(
      "blocked",
    );
  });

  it("allows restore into a non-empty table with --force", () => {
    expect(overwriteDecision({ existingCount: 1, force: true })).toBe(
      "allowed",
    );
    expect(overwriteDecision({ existingCount: 42, force: true })).toBe(
      "allowed",
    );
  });

  it("allows restore into an empty table regardless of --force", () => {
    expect(overwriteDecision({ existingCount: 0, force: false })).toBe(
      "allowed",
    );
    expect(overwriteDecision({ existingCount: 0, force: true })).toBe(
      "allowed",
    );
  });
});

// main()-level coverage for the data-loss control: the guard must block (exit 3)
// BEFORE any mutating call, and --force must be the only way past a non-empty
// table. The deferred db/store imports are mocked above, so no real db/network
// is touched; fs.readFileSync is stubbed so no real snapshot file is read.
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("main() overwrite guard (data-loss control)", () => {
  it("exits 3 and never mutates when the table is non-empty without --force", async () => {
    const { restoreCases } = await import("../../lib/storage/pg-backup.ts");
    const { getCaseStore } = await import(
      "../../lib/storage/case-store-factory.ts"
    );
    const save = vi.fn();
    vi.mocked(getCaseStore).mockReturnValue({
      list: vi.fn(async () => [{ id: "existing" }]),
      save,
      get: vi.fn(),
    });
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({ rows: [{ id: "a" }] }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code) => {
        throw new Error(`__exit_${code}__`);
      }) as never);

    await expect(
      main(["snap.json"], { SLAPROOF_STORE: "postgres" }),
    ).rejects.toThrow("__exit_3__");
    expect(exitSpy).toHaveBeenCalledWith(EXIT_OVERWRITE_GUARD);
    expect(restoreCases).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("proceeds to restore when --force is given on a non-empty table", async () => {
    const { restoreCases } = await import("../../lib/storage/pg-backup.ts");
    const { getCaseStore } = await import(
      "../../lib/storage/case-store-factory.ts"
    );
    vi.mocked(getCaseStore).mockReturnValue({
      list: vi.fn(async () => [{ id: "existing" }]),
      save: vi.fn(),
      get: vi.fn(),
    });
    vi.mocked(restoreCases).mockResolvedValue(1);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({ rows: [{ id: "a" }] }),
    );
    vi.spyOn(console, "log").mockImplementation(() => {});

    await main(["snap.json", "--force"], { SLAPROOF_STORE: "postgres" });
    expect(restoreCases).toHaveBeenCalledOnce();
  });
});
