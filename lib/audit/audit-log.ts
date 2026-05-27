import fs from "node:fs";
import path from "node:path";
import { redactDetails } from "@/lib/observability/redact";

export { redactDetails };

const AUDIT_DIR = path.join(process.cwd(), ".data");
const AUDIT_PATH = path.join(AUDIT_DIR, "audit.log.jsonl");

export type AuditAction =
  | "case_created"
  | "case_updated"
  | "case_submitted"
  | "case_failed";

export type AuditEntry = {
  timestamp: string;
  action: AuditAction;
  caseId: string;
  actor: string;
  details?: Record<string, unknown>;
};

function ensureAuditFile(): void {
  if (!fs.existsSync(AUDIT_DIR)) {
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
  }
  if (!fs.existsSync(AUDIT_PATH)) {
    fs.writeFileSync(AUDIT_PATH, "", "utf-8");
  }
}

export function appendAudit(entry: Omit<AuditEntry, "timestamp">): void {
  ensureAuditFile();
  const full: AuditEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
    details: redactDetails(entry.details),
  };
  fs.appendFileSync(AUDIT_PATH, `${JSON.stringify(full)}\n`, "utf-8");
}

export function readAudit(filter?: { caseId?: string }): AuditEntry[] {
  ensureAuditFile();
  const raw = fs.readFileSync(AUDIT_PATH, "utf-8");
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
  return AUDIT_PATH;
}
