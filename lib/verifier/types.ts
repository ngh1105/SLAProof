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

export type VerifierErrorCode =
  | "USER_REJECTED"
  | "RPC_FAILED"
  | "EXECUTION_FAILED"
  | "TIMEOUT"
  | "MISSING_RECEIPT"
  | "UNKNOWN";

export class VerifierError extends Error {
  public readonly code: VerifierErrorCode;
  public readonly cause?: unknown;
  constructor(code: VerifierErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "VerifierError";
    this.code = code;
    this.cause = cause;
  }
}

export type SubmitCaseInput = {
  slaCase: SlaCase;
  walletClient: unknown;
};

export type SubmitCaseResult = { txHash: `0x${string}` };

export type SlaVerifier = {
  readiness: VerifierReadiness;
  verifyCase(slaCase: SlaCase): Promise<VerifyResult>;
  getReceipt(caseId: string): Promise<Receipt | null>;
  submitCase?(input: SubmitCaseInput): Promise<SubmitCaseResult>;
  waitForFinalization?(txHash: `0x${string}`): Promise<void>;
};

