import { describe, expect, it } from "vitest";
import { hashEvidence, hashReceipt, simpleHash, stableStringify } from "@/lib/domain/hash";

describe("simpleHash", () => {
  it("returns the FNV-1a 32-bit hash with fnv1a: prefix", () => {
    expect(simpleHash("")).toMatch(/^fnv1a:[0-9a-f]{8}$/);
    expect(simpleHash("hello")).toMatch(/^fnv1a:[0-9a-f]{8}$/);
  });

  it("is deterministic for the same input", () => {
    expect(simpleHash("abc")).toBe(simpleHash("abc"));
  });

  it("differs for different inputs", () => {
    expect(simpleHash("a")).not.toBe(simpleHash("b"));
  });

  it("handles unicode code points", () => {
    expect(simpleHash("café")).toMatch(/^fnv1a:[0-9a-f]{8}$/);
    expect(simpleHash("café")).not.toBe(simpleHash("cafe"));
  });
});

describe("stableStringify", () => {
  it("sorts object keys for consistent output", () => {
    const a = stableStringify({ b: 1, a: 2 });
    const b = stableStringify({ a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it("preserves array order", () => {
    expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
  });

  it("handles nested objects + arrays", () => {
    const out = stableStringify({ z: { y: [1, 2] }, a: 0 });
    expect(out).toBe('{"a":0,"z":{"y":[1,2]}}');
  });

  it("serializes primitives like JSON.stringify", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify("hi")).toBe('"hi"');
  });
});

describe("hashEvidence", () => {
  it("normalizes whitespace before hashing", () => {
    expect(hashEvidence("  hello  world  ")).toBe(hashEvidence("hello world"));
    expect(hashEvidence("hello\n\tworld")).toBe(hashEvidence("hello world"));
  });

  it("differs for different content", () => {
    expect(hashEvidence("alpha")).not.toBe(hashEvidence("beta"));
  });
});

describe("hashReceipt", () => {
  const baseReceipt = {
    version: "slaproof.receipt.v0" as const,
    caseId: "c1",
    decision: "breach" as const,
    confidence: 88,
    violatedClauses: ["x"],
    evidenceCitations: [{ evidenceId: "ev-1", finding: "f" }],
    validatorReasoning: "r",
    recommendedNextAction: "a",
    createdAt: "2026-05-27T00:00:00Z",
  };

  it("is deterministic regardless of key order", () => {
    const a = hashReceipt(baseReceipt);
    const b = hashReceipt({
      createdAt: baseReceipt.createdAt,
      decision: baseReceipt.decision,
      caseId: baseReceipt.caseId,
      confidence: baseReceipt.confidence,
      version: baseReceipt.version,
      violatedClauses: baseReceipt.violatedClauses,
      evidenceCitations: baseReceipt.evidenceCitations,
      validatorReasoning: baseReceipt.validatorReasoning,
      recommendedNextAction: baseReceipt.recommendedNextAction,
    });
    expect(a).toBe(b);
  });

  it("changes when any field changes", () => {
    expect(hashReceipt(baseReceipt)).not.toBe(hashReceipt({ ...baseReceipt, confidence: 87 }));
    expect(hashReceipt(baseReceipt)).not.toBe(hashReceipt({ ...baseReceipt, decision: "no_breach" }));
  });
});
