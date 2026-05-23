import type { Receipt, SlaCase } from "@/lib/domain/types";

export type VerifierMode = "mock" | "genlayer";

export type VerifierReadiness = {
  mode: VerifierMode;
  ready: boolean;
  networkLabel: string;
  rpcUrl?: string;
  contractAddress?: string;
  issues: string[];
};

export type VerifyResult = {
  receipt: Receipt;
  source: VerifierMode;
  submittedPayload: string;
};

export type SlaVerifier = {
  readiness: VerifierReadiness;
  verifyCase(slaCase: SlaCase): Promise<VerifyResult>;
  getReceipt(caseId: string): Promise<Receipt | null>;
};

