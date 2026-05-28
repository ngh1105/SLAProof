import { describe, expect, it } from "vitest";
import { redactReceiptForExport } from "@/lib/export/receipt-redaction";
import type { Receipt } from "@/lib/domain/types";

function makeReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    version: "slaproof.receipt.v0",
    caseId: "case-rpc-breach-001",
    decision: "breach",
    confidence: 88,
    violatedClauses: ["5% request failures"],
    evidenceCitations: [{ evidenceId: "ev-1", finding: "clean finding" }],
    validatorReasoning: "All clean.",
    recommendedNextAction: "File claim.",
    createdAt: "2026-05-22T10:42:00Z",
    receiptHash: "fnv1a:abcdef00",
    ...overrides,
  };
}

describe("redactReceiptForExport", () => {
  it("returns identical receipt when no sensitive data", () => {
    const r = makeReceipt();
    const { receipt, redactions } = redactReceiptForExport(r);
    expect(redactions).toEqual([]);
    expect(receipt).toEqual(r);
  });

  it("redacts JWT inside reasoning", () => {
    const r = makeReceipt({
      validatorReasoning:
        "Operator pasted token eyJabcdefghijk.eyJabcdefghijk.eyJabcdefghijk in error.",
    });
    const { receipt, redactions } = redactReceiptForExport(r);
    expect(redactions.length).toBeGreaterThan(0);
    expect(receipt.validatorReasoning).toContain("[REDACTED:jwt]");
    expect(receipt.validatorReasoning).not.toContain("eyJabcdefghijk.eyJabcdefghijk");
  });

  it("redacts AWS access key inside recommended action", () => {
    const r = makeReceipt({
      recommendedNextAction: "Rotate AKIAIOSFODNN7EXAMPLE before escalation.",
    });
    const { receipt, redactions } = redactReceiptForExport(r);
    expect(redactions.some((m) => /AWS/i.test(m))).toBe(true);
    expect(receipt.recommendedNextAction).toContain("[REDACTED:aws-key]");
  });

  it("redacts secrets inside evidence citations", () => {
    const r = makeReceipt({
      evidenceCitations: [
        {
          evidenceId: "ev-1",
          finding: "log line: sk_live_aaaaaaaaaaaaaaaaaaaaaaaa observed",
        },
      ],
    });
    const { receipt, redactions } = redactReceiptForExport(r);
    expect(redactions.some((m) => /Stripe/i.test(m))).toBe(true);
    expect(receipt.evidenceCitations[0].finding).toContain("[REDACTED:stripe-key]");
  });

  it("redacts secrets inside violated clauses", () => {
    const r = makeReceipt({
      violatedClauses: ["clause references token=ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    });
    const { receipt, redactions } = redactReceiptForExport(r);
    expect(redactions.some((m) => /GitHub/i.test(m))).toBe(true);
    expect(receipt.violatedClauses[0]).toContain("[REDACTED:github-token]");
  });
});
