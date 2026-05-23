import type { Receipt, SlaCase } from "@/lib/domain/types";
import { toContractCaseJson } from "@/lib/genlayer/contract-payload";
import type { SlaVerifier, VerifierReadiness, VerifyResult } from "@/lib/verifier/types";

function getReadiness(): VerifierReadiness {
  const rpcUrl = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS;
  const networkLabel = process.env.NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL || "Studionet";
  const issues: string[] = [];

  if (!rpcUrl) issues.push("NEXT_PUBLIC_GENLAYER_RPC_URL is not configured.");
  if (!contractAddress) issues.push("NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS is not configured.");

  return {
    mode: "genlayer",
    ready: issues.length === 0,
    networkLabel,
    rpcUrl,
    contractAddress,
    issues,
  };
}

export const genlayerVerifierAdapter: SlaVerifier = {
  readiness: getReadiness(),
  async verifyCase(slaCase: SlaCase): Promise<VerifyResult> {
    const readiness = getReadiness();
    const submittedPayload = toContractCaseJson(slaCase);

    if (!readiness.ready) {
      throw new Error(readiness.issues.join(" "));
    }

    throw new Error(
      `Live GenLayer writes are gated until the contract is deployed and the genlayer-js call path is configured. Prepared payload bytes: ${submittedPayload.length}.`,
    );
  },
  async getReceipt(caseId: string): Promise<Receipt | null> {
    const readiness = getReadiness();
    void caseId;

    if (!readiness.ready) {
      return null;
    }

    throw new Error(
      "Live GenLayer reads are gated until the contract is deployed and the genlayer-js call path is configured.",
    );
  },
};
