import { describe, expect, it } from "vitest";
import { mockVerifierAdapter } from "@/lib/verifier/mock-adapter";
import { getDemoCase } from "@/lib/domain/fixtures";

describe("mockVerifierAdapter", () => {
  it("readiness reports mock mode and is ready", () => {
    expect(mockVerifierAdapter.readiness.mode).toBe("mock");
    expect(mockVerifierAdapter.readiness.ready).toBe(true);
    expect(mockVerifierAdapter.readiness.issues).toEqual([]);
  });

  it("verifyCase returns a deterministic receipt + submittedPayload", async () => {
    const slaCase = (await getDemoCase("case-rpc-breach-001"))!;
    const result = await mockVerifierAdapter.verifyCase(slaCase);
    expect(result.source).toBe("mock");
    expect(result.receipt.caseId).toBe(slaCase.id);
    expect(result.receipt.decision).toBe("breach");
    expect(typeof result.submittedPayload).toBe("string");
    const parsed = JSON.parse(result.submittedPayload);
    expect(parsed.case_id).toBe(slaCase.id);
  });

  it("verifyCase is idempotent (same input -> same receipt hash)", async () => {
    const slaCase = (await getDemoCase("case-rpc-breach-001"))!;
    const a = await mockVerifierAdapter.verifyCase(slaCase);
    const b = await mockVerifierAdapter.verifyCase(slaCase);
    expect(a.receipt.receiptHash).toBe(b.receipt.receiptHash);
  });

  it("getReceipt returns the seeded mock verdict for a known case", async () => {
    const r = await mockVerifierAdapter.getReceipt("case-rpc-breach-001");
    expect(r).not.toBeNull();
    expect(r!.caseId).toBe("case-rpc-breach-001");
    expect(r!.decision).toBe("breach");
  });

  it("getReceipt returns null for an unknown case", async () => {
    const r = await mockVerifierAdapter.getReceipt("not-a-real-case");
    expect(r).toBeNull();
  });
});
