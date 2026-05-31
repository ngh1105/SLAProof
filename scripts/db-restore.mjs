// Postgres `cases` logical restore script.
//
// Replays a JSON snapshot (produced by scripts/db-backup.mjs) back into the
// Postgres-backed case store. Env-guarded: restoring into the wrong store is
// an error, not a silent skip, so it exits nonzero when SLAPROOF_STORE is not
// postgres. An overwrite guard refuses to restore into a non-empty `cases`
// table unless --force is given, so a stray restore can't clobber live data.
//
// Usage:
//   SLAPROOF_STORE=postgres node scripts/db-restore.mjs <snapshot.json>
//   SLAPROOF_STORE=postgres node scripts/db-restore.mjs <snapshot.json> --force
//
// Exit codes:
//   0  restore succeeded (or guard allowed an empty-table restore)
//   1  unexpected runtime error / wrong store (SLAPROOF_STORE != postgres)
//   2  bad CLI args (missing snapshot path)
//   3  overwrite guard tripped (non-empty table, no --force)

import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** Exit code returned on invalid CLI arguments (missing snapshot path). */
export const EXIT_BAD_ARGS = 2;

/** Exit code returned when the overwrite guard blocks a non-empty restore. */
export const EXIT_OVERWRITE_GUARD = 3;

/**
 * Parse the required snapshot path argument. Returns the first non-flag arg
 * (anything not starting with `--`), or null when no path is present. Pure:
 * operates only on the passed args array so it is trivially testable.
 */
export function parsePath(args) {
  for (const arg of args) {
    if (!arg.startsWith("--")) return arg;
  }
  return null;
}

/**
 * Decide whether to skip the restore based on the active store. Pure: reads the
 * passed env object so it is trivially testable. Returns true unless the store
 * is postgres (case-insensitive). main() treats a skip as an error (exit 1),
 * since restoring into the wrong store would silently no-op.
 */
export function shouldSkip(env = process.env) {
  const mode = (env.SLAPROOF_STORE ?? "file").toLowerCase();
  return mode !== "postgres";
}

/**
 * Overwrite-guard decision. Pure: given the current row count and the --force
 * flag, returns "blocked" when the table is non-empty and --force is absent,
 * otherwise "allowed". An empty table is always allowed.
 */
export function overwriteDecision({ existingCount, force }) {
  if (existingCount > 0 && !force) return "blocked";
  return "allowed";
}

/**
 * Run the restore. Guarded behind the main-module check below so importing this
 * file for its pure helpers never touches the db, network, or filesystem.
 */
export async function main(argv = process.argv.slice(2), env = process.env) {
  const snapshotPath = parsePath(argv);
  if (snapshotPath === null) {
    console.error(
      "Usage: SLAPROOF_STORE=postgres node scripts/db-restore.mjs <snapshot.json> [--force]",
    );
    process.exit(EXIT_BAD_ARGS);
    return;
  }

  if (shouldSkip(env)) {
    const mode = (env.SLAPROOF_STORE ?? "file").toLowerCase();
    console.error(
      `SLAPROOF_STORE is "${mode}", not "postgres"; refusing to restore into the wrong store.`,
    );
    process.exit(1);
    return;
  }

  const force = argv.includes("--force");

  // Heavy imports are deferred to here so the unit test (pure helpers only)
  // never loads the pg driver, the store factory, or reads the snapshot file.
  const { restoreCases } = await import("../lib/storage/pg-backup.ts");
  const { getCaseStore } = await import("../lib/storage/case-store-factory.ts");
  const { closePool } = await import("../lib/storage/case-store-postgres.ts");

  try {
    const raw = fs.readFileSync(snapshotPath, "utf-8");
    const snapshot = JSON.parse(raw);

    const store = getCaseStore();
    const existing = await store.list();
    const decision = overwriteDecision({
      existingCount: existing.length,
      force,
    });
    if (decision === "blocked") {
      console.error(
        `Refusing to restore: the cases table already has ${existing.length} ` +
          `row(s). Re-run with --force to overwrite.`,
      );
      process.exit(EXIT_OVERWRITE_GUARD);
      return;
    }

    const restored = await restoreCases(store, snapshot);
    console.log(`Restore complete: ${restored} case(s) from ${snapshotPath}`);
  } finally {
    await closePool();
  }
}

// Only run when invoked directly (node scripts/db-restore.mjs), never on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
