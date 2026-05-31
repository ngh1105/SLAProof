import fs from "node:fs";
import path from "node:path";
import { redactDetails } from "@/lib/observability/redact";

export { redactDetails };

const DEFAULT_AUDIT_DIR = path.join(process.cwd(), ".data");
const DEFAULT_AUDIT_PATH = path.join(DEFAULT_AUDIT_DIR, "audit.log.jsonl");

// Resolve the audit log path lazily on every call so tests can isolate their
// writes via SLAPROOF_AUDIT_PATH (a per-worker temp file) instead of racing on
// the single shared .data/audit.log.jsonl under Vitest's parallel workers.
// Production leaves the env unset → identical default behavior.
function auditFilePath(): string {
  return process.env.SLAPROOF_AUDIT_PATH ?? DEFAULT_AUDIT_PATH;
}

export type AuditAction =
  | "case_created"
  | "case_updated"
  | "case_submitted"
  | "case_failed"
  | "evidence_added";

export type AuditEntry = {
  timestamp: string;
  action: AuditAction;
  caseId: string;
  actor: string;
  details?: Record<string, unknown>;
};

function ensureAuditFile(): void {
  const file = auditFilePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "", "utf-8");
  }
}

export function appendAudit(entry: Omit<AuditEntry, "timestamp">): void {
  ensureAuditFile();
  const full: AuditEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
    details: redactDetails(entry.details),
  };
  fs.appendFileSync(auditFilePath(), `${JSON.stringify(full)}\n`, "utf-8");
}

export function readAudit(filter?: { caseId?: string }): AuditEntry[] {
  ensureAuditFile();
  const raw = fs.readFileSync(auditFilePath(), "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  const entries: AuditEntry[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as AuditEntry;
      if (filter?.caseId && parsed.caseId !== filter.caseId) continue;
      entries.push(parsed);
    } catch {
      // skip malformed line
    }
  }
  return entries;
}

export function auditPath(): string {
  return auditFilePath();
}
