import { toContractCaseJson } from "@/lib/genlayer/contract-payload";
import { getDemoCase } from "@/lib/domain/fixtures";
import type { Receipt, SlaCase } from "@/lib/domain/types";
import { verifyCaseLocally } from "@/lib/verifier/mock-verifier";
import type { SlaVerifier, VerifierReadiness, VerifyResult } from "@/lib/verifier/types";

const readiness: VerifierReadiness = {
  mode: "mock",
  ready: true,
  networkLabel: "Local demo",
  contractAddress: "mock:local-demo",
  issues: [],
};

export const mockVerifierAdapter: SlaVerifier = {
  readiness,
  async verifyCase(slaCase: SlaCase): Promise<VerifyResult> {
    return {
      receipt: verifyCaseLocally(slaCase),
      source: "mock",
      submittedPayload: toContractCaseJson(slaCase),
    };
  },
  async getReceipt(caseId: string): Promise<Receipt | null> {
    const slaCase = await getDemoCase(caseId);
    return slaCase ? verifyCaseLocally(slaCase) : null;
  },
};

