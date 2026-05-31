import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { GET as auditGet } from "@/app/api/audit/route";
import { appendAudit } from "@/lib/audit/audit-log";

// Isolate this suite's audit log to a unique temp file so it can't race the
// shared .data/audit.log.jsonl with other test files under Vitest's parallel
// workers. The audit module resolves SLAPROOF_AUDIT_PATH lazily per call.
const TMP_AUDIT = path.join(
  os.tmpdir(),
  `slaproof-audit-api-${process.pid}.log.jsonl`,
);
process.env.SLAPROOF_AUDIT_PATH = TMP_AUDIT;

function buildRequest(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

describe("/api/audit", () => {
  beforeEach(() => {
    if (fs.existsSync(TMP_AUDIT)) fs.unlinkSync(TMP_AUDIT);
  });
  afterEach(() => {
    if (fs.existsSync(TMP_AUDIT)) fs.unlinkSync(TMP_AUDIT);
  });

  it("returns empty list when no entries", async () => {
    const res = await auditGet(buildRequest("http://localhost/api/audit"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.count).toBe(0);
    expect(body.total).toBe(0);
    expect(body.entries).toEqual([]);
  });

  it("returns all entries up to default limit", async () => {
    for (let i = 0; i < 5; i++) {
      appendAudit({ action: "case_created", caseId: `c-${i}`, actor: "test" });
    }
    const res = await auditGet(buildRequest("http://localhost/api/audit"));
    const body = await res.json();
    expect(body.count).toBe(5);
    expect(body.total).toBe(5);
    expect(body.entries).toHaveLength(5);
  });

  it("filters by caseId", async () => {
    appendAudit({ action: "case_created", caseId: "alpha", actor: "test" });
    appendAudit({ action: "case_created", caseId: "beta", actor: "test" });
    appendAudit({ action: "case_failed", caseId: "alpha", actor: "test" });
    const res = await auditGet(buildRequest("http://localhost/api/audit?caseId=alpha"));
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.entries.every((e: { caseId: string }) => e.caseId === "alpha")).toBe(true);
  });

  it("respects limit param up to MAX_LIMIT", async () => {
    for (let i = 0; i < 12; i++) {
      appendAudit({ action: "case_created", caseId: `c-${i}`, actor: "test" });
    }
    const res = await auditGet(buildRequest("http://localhost/api/audit?limit=5"));
    const body = await res.json();
    expect(body.count).toBe(5);
    expect(body.total).toBe(12);
  });

  it("clamps invalid limit to default", async () => {
    appendAudit({ action: "case_created", caseId: "c1", actor: "test" });
    const res = await auditGet(buildRequest("http://localhost/api/audit?limit=not-a-number"));
    const body = await res.json();
    expect(body.count).toBe(1);
  });
});
