import { describe, expect, it } from "vitest";
// Pure helpers only. Importing the script must NOT touch the db, the network,
// or the filesystem — the real run is guarded behind a main-module check.
// @ts-expect-error - db-restore.mjs is a plain ESM script with no .d.ts and allowJs is off, so TS cannot resolve its types; the exports are pure helpers exercised at runtime by vitest.
import { parsePath, shouldSkip, overwriteDecision, EXIT_BAD_ARGS, EXIT_OVERWRITE_GUARD } from "../../scripts/db-restore.mjs";

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
