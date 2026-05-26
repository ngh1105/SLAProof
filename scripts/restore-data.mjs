#!/usr/bin/env node
// Pilot data restore script.
//
// Reads a JSON snapshot produced by backup-data.mjs and writes its files back
// into .data/. Refuses to overwrite existing data unless --force is set.
//
// Usage:
//   node scripts/restore-data.mjs <backup-file>            # safe mode
//   node scripts/restore-data.mjs <backup-file> --force    # overwrite

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const force = args.includes("--force");

if (!file) {
  console.error("Usage: node scripts/restore-data.mjs <backup-file> [--force]");
  process.exit(2);
}

if (!fs.existsSync(file)) {
  console.error(`Backup not found: ${file}`);
  process.exit(2);
}

const raw = fs.readFileSync(file, "utf-8");
let snapshot;
try {
  snapshot = JSON.parse(raw);
} catch (err) {
  console.error(`Backup is not valid JSON: ${err instanceof Error ? err.message : err}`);
  process.exit(2);
}

if (!snapshot.files || typeof snapshot.files !== "object") {
  console.error("Backup missing files block.");
  process.exit(2);
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const conflicts = Object.keys(snapshot.files).filter((name) =>
  fs.existsSync(path.join(DATA_DIR, name)),
);
if (conflicts.length > 0 && !force) {
  console.error(
    `Refusing to overwrite existing data: ${conflicts.join(", ")}. Re-run with --force.`,
  );
  process.exit(3);
}

for (const [name, contents] of Object.entries(snapshot.files)) {
  const target = path.join(DATA_DIR, name);
  fs.writeFileSync(target, String(contents), "utf-8");
  console.log(`Restored ${target} (${String(contents).length} bytes)`);
}

console.log(`Restore complete from ${file} taken at ${snapshot.takenAt ?? "unknown"}.`);
