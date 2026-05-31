// Postgres `cases` logical backup script.
//
// Exports every row of the Postgres-backed case store to a timestamped JSON
// snapshot under .data/pg-backups/. Env-guarded: it only runs when
// SLAPROOF_STORE=postgres, and skips cleanly (exit 0) otherwise so it is safe
// to wire into deploy hooks regardless of the active store. Production-grade
// physical backups (pg_dump / PITR) are delegated to the managed provider;
// this is a portable logical snapshot for app-level restore.
//
// Usage:
//   SLAPROOF_STORE=postgres node scripts/db-backup.mjs            # snapshot now
//   SLAPROOF_STORE=postgres node scripts/db-backup.mjs --keep 7   # rotate, keep N

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Exit code returned on invalid CLI arguments. */
export const EXIT_BAD_ARGS = 2;

const BACKUP_DIR = path.join(process.cwd(), ".data", "pg-backups");
const PREFIX = "slaproof-pg-";
const SUFFIX = ".json";

/**
 * Parse the optional `--keep N` flag.
 * Returns the positive integer N, or null when the flag is absent.
 * Throws on a missing, non-numeric, or non-positive value — main() maps the
 * throw to process.exit(EXIT_BAD_ARGS).
 */
export function parseKeep(args) {
  const i = args.indexOf("--keep");
  if (i < 0) return null;
  const raw = args[i + 1];
  const n = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(n) || n < 1) {
    throw new Error("--keep requires a positive integer");
  }
  return n;
}

/**
 * Decide whether to skip the backup based on the active store. Pure: reads the
 * passed env object so it is trivially testable. Skips unless the store is
 * postgres (case-insensitive).
 */
export function shouldSkip(env = process.env) {
  const mode = (env.SLAPROOF_STORE ?? "file").toLowerCase();
  return mode !== "postgres";
}

/**
 * Build the snapshot filename for a given date: ISO with `:`/`.` flattened to
 * `-`, kept to millisecond resolution + "Z" so two backups in the same second
 * cannot collide/overwrite. The format still sorts chronologically as a string.
 * e.g. slaproof-pg-2026-05-30T09-24-05-123Z.json
 */
export function backupFilename(date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, "-").slice(0, 23) + "Z";
  return `${PREFIX}${stamp}${SUFFIX}`;
}

/**
 * Given a list of existing backup filenames and a keep count, return the
 * oldest entries to delete (everything beyond the newest `keep`). Pure: sorts a
 * copy lexically — the stamp format sorts chronologically — and slices.
 */
export function prune(list, keep) {
  const sorted = [...list]
    .filter((name) => name.startsWith(PREFIX) && name.endsWith(SUFFIX))
    .sort();
  return sorted.slice(0, Math.max(0, sorted.length - keep));
}

/**
 * Run the backup. Guarded behind the main-module check below so importing this
 * file for its pure helpers never touches the db, network, or filesystem.
 */
export async function main(argv = process.argv.slice(2), env = process.env) {
  let keep;
  try {
    keep = parseKeep(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(EXIT_BAD_ARGS);
    return;
  }

  if (shouldSkip(env)) {
    const mode = (env.SLAPROOF_STORE ?? "file").toLowerCase();
    console.log(
      `SLAPROOF_STORE is "${mode}", not "postgres"; skipping Postgres backup.`,
    );
    process.exit(0);
    return;
  }

  // Heavy imports are deferred to here so the unit test (pure helpers only)
  // never loads the pg driver or the store factory.
  const { dumpCases } = await import("../lib/storage/pg-backup.ts");
  const { getCaseStore } = await import("../lib/storage/case-store-factory.ts");
  const { closePool } = await import("../lib/storage/case-store-postgres.ts");

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  try {
    const snapshot = await dumpCases(getCaseStore());
    const target = path.join(BACKUP_DIR, backupFilename(new Date()));
    fs.writeFileSync(target, JSON.stringify(snapshot, null, 2), "utf-8");
    console.log(`Backup written: ${target} (${snapshot.count} case(s))`);

    if (keep !== null) {
      const all = fs.readdirSync(BACKUP_DIR);
      for (const name of prune(all, keep)) {
        fs.unlinkSync(path.join(BACKUP_DIR, name));
        console.log(`Pruned old backup: ${name}`);
      }
    }
  } finally {
    await closePool();
  }
}

// Only run when invoked directly (node scripts/db-backup.mjs), never on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
