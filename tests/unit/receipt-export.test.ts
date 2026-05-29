import { afterEach, describe, expect, it } from "vitest";
import { exportReceiptJson, exportReceiptMarkdown } from "@/lib/export/receipt-export";
import { snapshot, resetMetrics } from "@/lib/observability/metrics";
import type { Receipt } from "@/lib/domain/types";

const sample: Receipt = {
  version: "slaproof.receipt.v0",
  caseId: "case-rpc-breach-001",
  decision: "breach",
  confidence: 88,
  violatedClauses: ["5% request failures for 5+ consecutive minutes"],
  evidenceCitations: [
    { evidenceId: "ev-status", finding: "Status page confirms 18.6% errors" },
    { evidenceId: "ev-mon", finding: "Monitoring shows sustained 5xx" },
  ],
  validatorReasoning: "Sustained breach across the window.",
  recommendedNextAction: "Open service credit claim with the receipt attached.",
  createdAt: "2026-05-22T10:42:00Z",
  receiptHash: "fnv1a:abcdef00",
};

describe("exportReceiptJson", () => {
  afterEach(() => resetMetrics());

  it("produces deterministic indented JSON ending in newline", () => {
    const out = exportReceiptJson(sample);
    expect(out.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(out);
    expect(parsed).toMatchObject({
      caseId: sample.caseId,
      decision: sample.decision,
      receiptHash: sample.receiptHash,
    });
  });

  it("bumps export_receipt_json counter", () => {
    exportReceiptJson(sample);
    exportReceiptJson(sample);
    expect(snapshot().counters.export_receipt_json).toBe(2);
  });
});

describe("exportReceiptMarkdown", () => {
  afterEach(() => resetMetrics());

  it("includes decision, confidence, hash, clauses, citations, reasoning", async () => {
    const md = await exportReceiptMarkdown(sample);
    expect(md).toContain("# SLAProof Receipt:");
    expect(md).toContain("Decision: breach");
    expect(md).toContain("Confidence: 88%");
    expect(md).toContain(sample.receiptHash);
    expect(md).toContain("- 5% request failures for 5+ consecutive minutes");
    expect(md).toContain("ev-status");
    expect(md).toContain(sample.validatorReasoning);
    expect(md).toContain(sample.recommendedNextAction);
  });

  it("renders 'None' when no violated clauses", async () => {
    const md = await exportReceiptMarkdown({
      ...sample,
      violatedClauses: [],
    });
    expect(md).toMatch(/## Violated Clauses\n- None/);
  });

  it("falls back to caseId when seed case is missing", async () => {
    const md = await exportReceiptMarkdown({ ...sample, caseId: "case-not-seeded" });
    expect(md).toContain("# SLAProof Receipt: case-not-seeded");
  });

  it("bumps export_receipt_markdown counter", async () => {
    await exportReceiptMarkdown(sample);
    expect(snapshot().counters.export_receipt_markdown).toBe(1);
  });
});
