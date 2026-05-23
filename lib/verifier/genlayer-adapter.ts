import { hashReceipt } from "@/lib/domain/hash";
import type { Receipt, SlaCase } from "@/lib/domain/types";
import {
  fromContractReceipt,
  toContractCaseJson,
  type ContractReceipt,
} from "@/lib/genlayer/contract-payload";
import type { SlaVerifier, VerifierReadiness, VerifyResult } from "@/lib/verifier/types";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";

type GenLayerReadClient = {
  readContract(args: {
    address: `0x${string}`;
    functionName: string;
    args: unknown[];
  }): Promise<unknown>;
};

type GenLayerWriteClient = GenLayerReadClient & {
  writeContract(args: {
    address: `0x${string}`;
    functionName: string;
    args?: unknown[];
    value: bigint;
    leaderOnly?: boolean;
    consensusMaxRotations?: number;
  }): Promise<unknown>;
  waitForTransactionReceipt(args: {
    hash: `0x${string}`;
    status?: TransactionStatus;
    interval?: number;
    retries?: number;
  }): Promise<{
    txExecutionResultName?: ExecutionResult;
    statusName?: TransactionStatus;
  }>;
};

type GenLayerClientFactory = (rpcUrl: string) => Promise<GenLayerReadClient>;
type GenLayerWriteClientFactory = (
  rpcUrl: string,
  privateKey: `0x${string}`,
) => Promise<GenLayerWriteClient>;
type GenLayerSignerFactory = () => `0x${string}` | null;

type GenLayerVerifierOptions = {
  readClientFactory?: GenLayerClientFactory;
  writeClientFactory?: GenLayerWriteClientFactory;
  signerFactory?: GenLayerSignerFactory;
  pollIntervalMs?: number;
  pollRetries?: number;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePrivateKey(privateKey: string): `0x${string}` {
  const trimmed = privateKey.trim();
  const hex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;

  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "GENLAYER_PRIVATE_KEY must be a 32-byte hex string, with or without a 0x prefix.",
    );
  }

  return (`0x${hex}` as `0x${string}`);
}

function getSignerPrivateKey(): `0x${string}` | null {
  const privateKey = [
    process.env.GENLAYER_PRIVATE_KEY,
    process.env.GENLAYER_PRV_KEY,
    process.env.GENLAYER_PRIVKEY,
    process.env.PRIVATE_KEY,
  ].find((value) => value?.trim());

  return privateKey ? normalizePrivateKey(privateKey) : null;
}

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

async function loadGenLayerSdk() {
  const [{ createClient }, { studionet }] = await Promise.all([
    import("genlayer-js"),
    import("genlayer-js/chains"),
  ]);
  return { createClient, studionet };
}

async function createReadClient(rpcUrl: string): Promise<GenLayerReadClient> {
  const { createClient, studionet } = await loadGenLayerSdk();
  return createClient({ chain: studionet, endpoint: rpcUrl }) as GenLayerReadClient;
}

async function createWriteClient(
  rpcUrl: string,
  privateKey: `0x${string}`,
): Promise<GenLayerWriteClient> {
  const [{ createClient, createAccount }, { studionet }] = await Promise.all([
    import("genlayer-js"),
    import("genlayer-js/chains"),
  ]);

  return createClient({
    chain: studionet,
    endpoint: rpcUrl,
    account: createAccount(privateKey),
  }) as GenLayerWriteClient;
}

function getContractAddress(readiness: VerifierReadiness): `0x${string}` {
  const contractAddress = readiness.contractAddress;
  if (!contractAddress || !/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
    throw new Error("NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS must be a valid 0x address.");
  }
  return contractAddress as `0x${string}`;
}

async function readReceipt(
  caseId: string,
  readiness: VerifierReadiness,
  readClientFactory: GenLayerClientFactory,
): Promise<Receipt | null> {
  try {
    const client = await readClientFactory(readiness.rpcUrl!);
    const raw = await client.readContract({
      address: getContractAddress(readiness),
      functionName: "get_receipt",
      args: [caseId],
    });

    if (typeof raw !== "string" || raw.trim() === "") {
      return null;
    }

    return fromContractReceipt(JSON.parse(raw) as ContractReceipt);
  } catch (error) {
    if (error instanceof Error && /receipt not found/i.test(error.message)) {
      return null;
    }

    throw error;
  }
}

function normalizeTransactionHash(result: unknown): `0x${string}` {
  if (typeof result === "string" && /^0x[0-9a-fA-F]{64}$/.test(result)) {
    return result as `0x${string}`;
  }

  if (result && typeof result === "object") {
    const candidate = (result as { hash?: unknown; transactionHash?: unknown; txHash?: unknown })
      .hash;
    const alternative = (result as { hash?: unknown; transactionHash?: unknown; txHash?: unknown })
      .transactionHash;
    const txHash = (result as { hash?: unknown; transactionHash?: unknown; txHash?: unknown })
      .txHash;
    const values = [candidate, alternative, txHash];

    for (const value of values) {
      if (typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)) {
        return value as `0x${string}`;
      }
    }
  }

  throw new Error(
    `GenLayer writeContract returned an unexpected transaction hash: ${JSON.stringify(result)}`,
  );
}

function attachTransactionHash(receipt: Receipt, txHash: `0x${string}`): Receipt {
  if (receipt.transactionHash) {
    return receipt;
  }

  return {
    ...receipt,
    transactionHash: txHash,
  };
}

async function pollReceipt(
  caseId: string,
  readiness: VerifierReadiness,
  readClientFactory: GenLayerClientFactory,
  retries: number,
  intervalMs: number,
): Promise<Receipt | null> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const receipt = await readReceipt(caseId, readiness, readClientFactory);
    if (receipt) {
      return receipt;
    }

    if (attempt < retries - 1) {
      await delay(intervalMs);
    }
  }

  return null;
}

function createGatedReadReceipt(slaCase: SlaCase): Receipt {
  const receiptWithoutHash: Omit<Receipt, "receiptHash"> = {
    version: "slaproof.receipt.v0",
    caseId: slaCase.id,
    decision: "needs_more_evidence",
    confidence: 0,
    violatedClauses: [],
    evidenceCitations: [],
    validatorReasoning:
      "GenLayer live mode is currently read-only for this deployment. No on-chain receipt exists for this case yet, and live writes remain gated.",
    recommendedNextAction:
      "Submit the case after the GenLayer write path is enabled, or switch to mock mode for local demo verification.",
    createdAt: new Date(0).toISOString(),
    transactionHash: undefined,
  };

  return {
    ...receiptWithoutHash,
    receiptHash: hashReceipt(receiptWithoutHash),
  };
}

export function createGenLayerVerifier(
  depsOrReadClientFactory: GenLayerClientFactory | GenLayerVerifierOptions = {},
): SlaVerifier {
  const deps =
    typeof depsOrReadClientFactory === "function"
      ? { readClientFactory: depsOrReadClientFactory }
      : depsOrReadClientFactory;
  const readClientFactory = deps.readClientFactory ?? createReadClient;
  const writeClientFactory = deps.writeClientFactory ?? createWriteClient;
  const signerFactory = deps.signerFactory ?? getSignerPrivateKey;
  const pollRetries = deps.pollRetries ?? 12;
  const pollIntervalMs = deps.pollIntervalMs ?? 1500;

  return {
    readiness: getReadiness(),
    async verifyCase(slaCase: SlaCase): Promise<VerifyResult> {
      const readiness = getReadiness();
      const submittedPayload = toContractCaseJson(slaCase);

      if (!readiness.ready) {
        throw new Error(readiness.issues.join(" "));
      }

      const privateKey = signerFactory();
      if (privateKey) {
        const writeClient = await writeClientFactory(readiness.rpcUrl!, privateKey);
        const txHash = normalizeTransactionHash(
          await writeClient.writeContract({
            address: getContractAddress(readiness),
            functionName: "submit_case",
            args: [slaCase.id, submittedPayload],
            value: 0n,
          }),
        );

        const transactionReceipt = await writeClient.waitForTransactionReceipt({
          hash: txHash,
          status: TransactionStatus.FINALIZED,
          interval: pollIntervalMs,
          retries: pollRetries,
        });

        if (transactionReceipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
          throw new Error(`GenLayer transaction ${txHash} finished with an execution error.`);
        }

        const receipt = await pollReceipt(
          slaCase.id,
          readiness,
          readClientFactory,
          pollRetries,
          pollIntervalMs,
        );

        if (!receipt) {
          throw new Error(
            `GenLayer transaction ${txHash} finalized, but receipt ${slaCase.id} is not readable yet.`,
          );
        }

        return {
          receipt: attachTransactionHash(receipt, txHash),
          source: "genlayer",
          submittedPayload,
        };
      }

      const receipt = await readReceipt(slaCase.id, readiness, readClientFactory);

      return {
        receipt: receipt ?? createGatedReadReceipt(slaCase),
        source: "genlayer",
        submittedPayload,
      };
    },
    async getReceipt(caseId: string): Promise<Receipt | null> {
      const readiness = getReadiness();

      if (!readiness.ready) {
        return null;
      }

      return readReceipt(caseId, readiness, readClientFactory);
    },
  };
}

export const genlayerVerifierAdapter: SlaVerifier = createGenLayerVerifier();
