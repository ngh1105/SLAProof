#!/usr/bin/env node
// Pilot data backup script.
//
// Snapshots .data/db.json + .data/audit.log.jsonl into a timestamped tarball
// under .data/backups/. Pilot scope only — production needs a managed backup
// solution (S3 + lifecycle policy + encryption-at-rest).
//
// Usage:
//   node scripts/backup-data.mjs                 # snapshot now
//   node scripts/backup-data.mjs --keep 7        # rotate, keep last N

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const DATA_DIR = path.join(process.cwd(), ".data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

const args = process.argv.slice(2);
const keepIndex = args.indexOf("--keep");
const keep = keepIndex >= 0 ? Number.parseInt(args[keepIndex + 1] ?? "", 10) : null;

if (keep !== null && (Number.isNaN(keep) || keep < 1)) {
  console.error("--keep requires a positive integer");
  process.exit(2);
}

if (!fs.existsSync(DATA_DIR)) {
  console.log(`No .data directory; nothing to back up.`);
  process.exit(0);
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const candidates = ["db.json", "audit.log.jsonl"]
  .map((f) => path.join(DATA_DIR, f))
  .filter((p) => fs.existsSync(p));

if (candidates.length === 0) {
  console.log("No data files to back up.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z";
const target = path.join(BACKUP_DIR, `slaproof-${stamp}.json`);

const snapshot = {
  takenAt: new Date().toISOString(),
  files: Object.fromEntries(
    candidates.map((p) => [path.basename(p), fs.readFileSync(p, "utf-8")]),
  ),
};

fs.writeFileSync(target, JSON.stringify(snapshot, null, 2), "utf-8");
console.log(`Backup written: ${target}`);

if (keep !== null) {
  const all = fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith("slaproof-") && name.endsWith(".json"))
    .sort();
  const toDelete = all.slice(0, Math.max(0, all.length - keep));
  for (const name of toDelete) {
    fs.unlinkSync(path.join(BACKUP_DIR, name));
    console.log(`Pruned old backup: ${name}`);
  }
}

// Optional: log a free git ref of the current code revision alongside the data
// so restore + redeploy stays consistent.
try {
  const sha = execSync("git rev-parse HEAD").toString().trim();
  fs.writeFileSync(`${target}.commit`, `${sha}\n`, "utf-8");
} catch {
  // Not a git checkout or git missing — fine for the pilot
}
