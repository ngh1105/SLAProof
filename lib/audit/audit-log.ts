import fs from "node:fs";
import path from "node:path";

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

// Keys whose values must never land in the audit log. We blanket-redact
// rather than allow-list because details are written by many call sites
// and a future contributor may pass through user-controlled fields.
const REDACT_KEYS = [
  "password", "passwd", "secret", "token", "api_key", "apiKey",
  "privateKey", "private_key", "authorization", "cookie", "session",
];

function isSensitiveKey(key: string): boolean {
  const lc = key.toLowerCase();
  return REDACT_KEYS.some((k) => lc.includes(k.toLowerCase()));
}

export function redactDetails(input: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isSensitiveKey(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redactDetails(value as Record<string, unknown>);
      continue;
    }
    if (typeof value === "string" && value.length > 500) {
      out[key] = `${value.slice(0, 500)}...[truncated ${value.length - 500} chars]`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

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
