#!/usr/bin/env node
// Audit log rotation script.
//
// Rotates .data/audit.log.jsonl when it exceeds the size threshold (default
// 50 MB) or unconditionally with --force. Renames to audit.log.jsonl.YYYY-QN
// (year + quarter) and creates a fresh empty file. Honors the data retention
// policy in docs/policies/data-retention-policy.md.
//
// Usage:
//   node scripts/rotate-audit-log.mjs            # rotate if > 50 MB
//   node scripts/rotate-audit-log.mjs --force    # rotate regardless of size

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const AUDIT_PATH = path.join(DATA_DIR, "audit.log.jsonl");
const SIZE_THRESHOLD_MB = 50;

const force = process.argv.includes("--force");

if (!fs.existsSync(AUDIT_PATH)) {
  console.log(`No audit log at ${AUDIT_PATH}; nothing to rotate.`);
  process.exit(0);
}

const stat = fs.statSync(AUDIT_PATH);
const sizeMb = stat.size / (1024 * 1024);

if (!force && sizeMb < SIZE_THRESHOLD_MB) {
  console.log(`Audit log is ${sizeMb.toFixed(2)} MB — under ${SIZE_THRESHOLD_MB} MB threshold. Skip.`);
  process.exit(0);
}

const now = new Date();
const year = now.getUTCFullYear();
const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
const stamp = `${year}-Q${quarter}`;

let target = `${AUDIT_PATH}.${stamp}`;
let suffix = 0;
while (fs.existsSync(target)) {
  suffix += 1;
  target = `${AUDIT_PATH}.${stamp}.${suffix}`;
}

fs.renameSync(AUDIT_PATH, target);
fs.writeFileSync(AUDIT_PATH, "", "utf-8");
console.log(`Rotated ${AUDIT_PATH} -> ${target} (${sizeMb.toFixed(2)} MB).`);
