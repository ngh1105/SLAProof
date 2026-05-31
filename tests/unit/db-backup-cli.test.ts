import { describe, expect, it } from "vitest";
// Pure helpers only. Importing the script must NOT touch the db, the network,
// or the filesystem — the real run is guarded behind a main-module check.
// @ts-expect-error - db-backup.mjs is a plain ESM script with no .d.ts and allowJs is off, so TS cannot resolve its types; the exports are pure helpers exercised at runtime by vitest.
import { parseKeep, shouldSkip, prune, backupFilename, EXIT_BAD_ARGS } from "../../scripts/db-backup.mjs";

describe("parseKeep", () => {
  it("returns null when --keep is absent", () => {
    expect(parseKeep([])).toBeNull();
    expect(parseKeep(["--other", "5"])).toBeNull();
  });

  it("returns the positive integer when --keep N is valid", () => {
    expect(parseKeep(["--keep", "7"])).toBe(7);
    expect(parseKeep(["--keep", "1"])).toBe(1);
    expect(parseKeep(["--before", "x", "--keep", "12"])).toBe(12);
  });

  it("throws on a missing value", () => {
    expect(() => parseKeep(["--keep"])).toThrow();
  });

  it("throws on zero or negative N", () => {
    expect(() => parseKeep(["--keep", "0"])).toThrow();
    expect(() => parseKeep(["--keep", "-3"])).toThrow();
  });

  it("throws on a non-numeric N (NaN)", () => {
    expect(() => parseKeep(["--keep", "abc"])).toThrow();
  });
});

describe("EXIT_BAD_ARGS", () => {
  it("is the documented exit code for invalid input", () => {
    expect(EXIT_BAD_ARGS).toBe(2);
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

describe("prune", () => {
  const sample = [
    "slaproof-pg-2026-05-01T00-00-00Z.json",
    "slaproof-pg-2026-05-02T00-00-00Z.json",
    "slaproof-pg-2026-05-03T00-00-00Z.json",
    "slaproof-pg-2026-05-04T00-00-00Z.json",
  ];

  it("returns the oldest entries beyond the keep count", () => {
    expect(prune(sample, 2)).toEqual([
      "slaproof-pg-2026-05-01T00-00-00Z.json",
      "slaproof-pg-2026-05-02T00-00-00Z.json",
    ]);
  });

  it("keeps only the single newest when keep is 1", () => {
    expect(prune(sample, 1)).toEqual([
      "slaproof-pg-2026-05-01T00-00-00Z.json",
      "slaproof-pg-2026-05-02T00-00-00Z.json",
      "slaproof-pg-2026-05-03T00-00-00Z.json",
    ]);
  });

  it("deletes nothing when keep >= list length", () => {
    expect(prune(sample, 4)).toEqual([]);
    expect(prune(sample, 10)).toEqual([]);
  });

  it("sorts before slicing so order of input does not matter", () => {
    const shuffled = [sample[2], sample[0], sample[3], sample[1]];
    expect(prune(shuffled, 2)).toEqual([
      "slaproof-pg-2026-05-01T00-00-00Z.json",
      "slaproof-pg-2026-05-02T00-00-00Z.json",
    ]);
  });

  it("ignores files that are not slaproof-pg-*.json (delete-path safety)", () => {
    const withStrays = [
      ...sample,
      "README.txt",
      "slaproof-other.txt",
      "db.json",
      "slaproof-pg-notjson",
    ];
    // Only the two oldest matching backups should ever be returned for deletion.
    expect(prune(withStrays, 2)).toEqual([
      "slaproof-pg-2026-05-01T00-00-00Z.json",
      "slaproof-pg-2026-05-02T00-00-00Z.json",
    ]);
  });
});

describe("backupFilename", () => {
  it("builds a slaproof-pg-<stamp>.json name from a date (ms resolution)", () => {
    const name = backupFilename(new Date("2026-05-30T09:24:05.123Z"));
    expect(name).toBe("slaproof-pg-2026-05-30T09-24-05-123Z.json");
  });

  it("does not collide for two dates in the same second", () => {
    const a = backupFilename(new Date("2026-05-30T09:24:05.001Z"));
    const b = backupFilename(new Date("2026-05-30T09:24:05.999Z"));
    expect(a).not.toBe(b);
  });

  it("always matches the expected pattern", () => {
    const name = backupFilename(new Date());
    expect(name).toMatch(/^slaproof-pg-.+\.json$/);
  });
});
