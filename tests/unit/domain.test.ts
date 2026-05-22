import { describe, expect, it } from "vitest";
import { demoCases, getDemoCase } from "@/lib/domain/fixtures";
import { hashEvidence, hashReceipt } from "@/lib/domain/hash";
import { formatUtcRange, validateSlaCase } from "@/lib/domain/validation";
import { exportReceiptJson, exportReceiptMarkdown } from "@/lib/export/receipt-export";
import { inferMockDecision, verifyCaseLocally } from "@/lib/verifier/mock-verifier";

describe("SLAProof domain fixtures", () => {
  it("exposes demo cases for all local verdict states", () => {
    const decisions = new Set(demoCases.map((slaCase) => inferMockDecision(slaCase)));

    expect(decisions).toEqual(
      new Set(["breach", "no_breach", "inconclusive", "needs_more_evidence"]),
    );
  });

  it("keeps required seeded case fields valid where ready", () => {
    for (const slaCase of demoCases.filter((item) => item.status === "ready")) {
      const result = validateSlaCase(slaCase);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it("rejects invalid incident windows", () => {
    const base = getDemoCase("case-rpc-breach-001");
    expect(base).toBeDefined();

    const invalid = {
      ...base!,
      incidentWindow: {
        startUtc: "2026-05-22T10:42:00Z",
        endUtc: "2026-05-22T10:05:00Z",
      },
    };

    expect(validateSlaCase(invalid).errors).toContain(
      "Incident start must be before incident end.",
    );
  });

  it("formats UTC incident ranges predictably", () => {
    const slaCase = getDemoCase("case-rpc-breach-001");

    expect(formatUtcRange(slaCase!)).toBe("2026-05-22T10:05:00Z to 2026-05-22T10:42:00Z");
  });

  it("hashes evidence stably", () => {
    expect(hashEvidence("Elevated 5xx errors")).toBe(hashEvidence("Elevated 5xx errors"));
    expect(hashEvidence("Elevated 5xx errors")).not.toBe(hashEvidence("Elevated 4xx errors"));
  });
});

describe("mock verifier", () => {
  it("returns breach with citations for the confirmed case", () => {
    const receipt = verifyCaseLocally(getDemoCase("case-rpc-breach-001")!);

    expect(receipt.decision).toBe("breach");
    expect(receipt.violatedClauses).toContain("5% request failures for 5+ consecutive minutes");
    expect(receipt.evidenceCitations.length).toBeGreaterThan(0);
  });

  it("returns no breach when evidence stays below threshold", () => {
    expect(verifyCaseLocally(getDemoCase("case-rpc-clean-002")!).decision).toBe("no_breach");
  });

  it("returns inconclusive for contradictory or incomplete proof", () => {
    expect(verifyCaseLocally(getDemoCase("case-rpc-inconclusive-003")!).decision).toBe(
      "inconclusive",
    );
  });

  it("returns needs_more_evidence when SLA terms are missing", () => {
    expect(verifyCaseLocally(getDemoCase("case-rpc-missing-004")!).decision).toBe(
      "needs_more_evidence",
    );
  });

  it("creates deterministic receipt hashes", () => {
    const receipt = verifyCaseLocally(getDemoCase("case-rpc-breach-001")!);
    const withoutHash = { ...receipt };
    delete (withoutHash as Partial<typeof receipt>).receiptHash;

    expect(hashReceipt(withoutHash as Omit<typeof receipt, "receiptHash">)).toBe(
      receipt.receiptHash,
    );
  });

  it("exports JSON and Markdown with key receipt fields", () => {
    const receipt = verifyCaseLocally(getDemoCase("case-rpc-breach-001")!);

    expect(exportReceiptJson(receipt)).toContain('"decision": "breach"');
    expect(exportReceiptJson(receipt)).toContain(receipt.receiptHash);
    expect(exportReceiptMarkdown(receipt)).toContain("Decision: breach");
    expect(exportReceiptMarkdown(receipt)).toContain("## Evidence Citations");
  });
});
