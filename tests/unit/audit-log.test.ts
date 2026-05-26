import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendAudit, readAudit } from "@/lib/audit/audit-log";

const TMP_DIR = path.join(process.cwd(), ".data");
const TMP_AUDIT = path.join(TMP_DIR, "audit.log.jsonl");

describe("audit-log", () => {
  beforeEach(() => {
    if (fs.existsSync(TMP_AUDIT)) fs.unlinkSync(TMP_AUDIT);
  });
  afterEach(() => {
    if (fs.existsSync(TMP_AUDIT)) fs.unlinkSync(TMP_AUDIT);
  });

  it("appendAudit writes a JSONL line with timestamp", () => {
    appendAudit({ action: "case_created", caseId: "c1", actor: "test" });
    const content = fs.readFileSync(TMP_AUDIT, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.action).toBe("case_created");
    expect(parsed.caseId).toBe("c1");
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("readAudit returns entries in append order", () => {
    appendAudit({ action: "case_created", caseId: "c1", actor: "a" });
    appendAudit({ action: "case_submitted", caseId: "c1", actor: "a" });
    const entries = readAudit();
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe("case_created");
    expect(entries[1].action).toBe("case_submitted");
  });

  it("readAudit filters by caseId", () => {
    appendAudit({ action: "case_created", caseId: "c1", actor: "a" });
    appendAudit({ action: "case_created", caseId: "c2", actor: "a" });
    const filtered = readAudit({ caseId: "c2" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].caseId).toBe("c2");
  });

  it("readAudit ignores malformed lines without throwing", () => {
    appendAudit({ action: "case_created", caseId: "c1", actor: "a" });
    fs.appendFileSync(TMP_AUDIT, "{not-valid-json\n", "utf-8");
    appendAudit({ action: "case_failed", caseId: "c1", actor: "a" });
    const entries = readAudit();
    expect(entries).toHaveLength(2);
  });
});

describe("audit-log redaction", () => {
  beforeEach(() => {
    if (fs.existsSync(TMP_AUDIT)) fs.unlinkSync(TMP_AUDIT);
  });
  afterEach(() => {
    if (fs.existsSync(TMP_AUDIT)) fs.unlinkSync(TMP_AUDIT);
  });

  it("redacts sensitive keys (case-insensitive substring match)", () => {
    appendAudit({
      action: "case_failed",
      caseId: "c1",
      actor: "test",
      details: { password: "hunter2", api_key: "ghp_xxx", normal: "fine" },
    });
    const entries = readAudit();
    expect(entries[0].details).toEqual({
      password: "[REDACTED]",
      api_key: "[REDACTED]",
      normal: "fine",
    });
  });

  it("recurses into nested objects", () => {
    appendAudit({
      action: "case_failed",
      caseId: "c1",
      actor: "test",
      details: { nested: { authorization: "Bearer x", count: 5 } },
    });
    const entries = readAudit();
    expect((entries[0].details!.nested as Record<string, unknown>).authorization).toBe("[REDACTED]");
    expect((entries[0].details!.nested as Record<string, unknown>).count).toBe(5);
  });

  it("truncates long strings", () => {
    const longText = "a".repeat(800);
    appendAudit({
      action: "case_failed",
      caseId: "c1",
      actor: "test",
      details: { reason: longText },
    });
    const entries = readAudit();
    const reason = entries[0].details!.reason as string;
    expect(reason.length).toBeLessThan(longText.length);
    expect(reason).toContain("[truncated");
  });
});
