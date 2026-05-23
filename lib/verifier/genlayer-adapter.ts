import type { Receipt, SlaCase } from "@/lib/domain/types";
import {
  fromContractReceipt,
  toContractCaseJson,
  type ContractReceipt,
} from "@/lib/genlayer/contract-payload";
import type { SlaVerifier, VerifierReadiness, VerifyResult } from "@/lib/verifier/types";

type GenLayerReadClient = {
  readContract(args: {
    address: `0x${string}`;
    functionName: string;
    args: unknown[];
  }): Promise<unknown>;
};

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

async function createReadClient(): Promise<GenLayerReadClient> {
  const [{ createClient }, { studionet }] = await Promise.all([
    import("genlayer-js"),
    import("genlayer-js/chains"),
  ]);
  return createClient({ chain: studionet }) as GenLayerReadClient;
}

function getContractAddress(readiness: VerifierReadiness): `0x${string}` {
  const contractAddress = readiness.contractAddress;
  if (!contractAddress || !/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
    throw new Error("NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS must be a valid 0x address.");
  }
  return contractAddress as `0x${string}`;
}

export function createGenLayerVerifier(readClientFactory = createReadClient): SlaVerifier {
  return {
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

      if (!readiness.ready) {
        return null;
      }

      const client = await readClientFactory();
      const raw = await client.readContract({
        address: getContractAddress(readiness),
        functionName: "get_receipt",
        args: [caseId],
      });

      if (typeof raw !== "string" || raw.trim() === "") {
        return null;
      }

      return fromContractReceipt(JSON.parse(raw) as ContractReceipt);
    },
  };
}

export const genlayerVerifierAdapter: SlaVerifier = createGenLayerVerifier();
