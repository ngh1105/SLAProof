import { describe, expect, it } from "vitest";
import { demoCases, getDemoCase } from "@/lib/domain/fixtures";
import { hashEvidence, hashReceipt } from "@/lib/domain/hash";
import { formatUtcRange, validateSlaCase } from "@/lib/domain/validation";
import { exportReceiptJson, exportReceiptMarkdown } from "@/lib/export/receipt-export";
import { fromContractReceipt, toContractPayload } from "@/lib/genlayer/contract-payload";
import { inferMockDecision, verifyCaseLocally } from "@/lib/verifier/mock-verifier";
import { createGenLayerVerifier } from "@/lib/verifier/genlayer-adapter";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";

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

describe("contract payload mapper", () => {
  it("maps camelCase app data to the snake_case contract schema", () => {
    const payload = toContractPayload(getDemoCase("case-rpc-breach-001")!);

    expect(payload.version).toBe("slaproof.case.v0");
    expect(payload.case_id).toBe("case-rpc-breach-001");
    expect(payload.provider_name).toBe("Northstar RPC");
    expect(payload.incident_window.start_utc).toBe("2026-05-22T10:05:00Z");
    expect(payload.sla_terms.error_threshold).toContain("5%");
    expect(payload.evidence[0].submitted_excerpt).toContain("elevated 5xx");
  });

  it("maps contract receipts back to app receipt shape", () => {
    const receipt = fromContractReceipt({
      version: "slaproof.receipt.v0",
      case_id: "case-rpc-breach-001",
      decision: "breach",
      confidence: 88,
      violated_clauses: ["5% request failures"],
      evidence_citations: [{ evidence_id: "ev-status", finding: "Provider acknowledged outage." }],
      validator_reasoning: "Evidence supports a breach.",
      recommended_next_action: "Escalate.",
      created_at: "2026-05-22T15:00:00Z",
      transaction_hash: "0xabc",
      receipt_hash: "fnv1a:12345678",
    });

    expect(receipt.caseId).toBe("case-rpc-breach-001");
    expect(receipt.evidenceCitations[0].evidenceId).toBe("ev-status");
    expect(receipt.transactionHash).toBe("0xabc");
  });
});

describe("genlayer read adapter", () => {
  async function withGenLayerEnv(testFn: () => Promise<void>) {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_GENLAYER_RPC_URL: "https://studio.genlayer.com/api",
      NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS: "0x1111111111111111111111111111111111111111",
      NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL: "Studionet",
      GENLAYER_PRIVATE_KEY: "",
      GENLAYER_PRV_KEY: "",
      GENLAYER_PRIVKEY: "",
      PRIVATE_KEY: "",
    };

    try {
      await testFn();
    } finally {
      process.env = originalEnv;
    }
  }

  function contractReceiptJson(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      version: "slaproof.receipt.v0",
      case_id: "case-rpc-breach-001",
      decision: "breach",
      confidence: 88,
      violated_clauses: ["5% request failures"],
      evidence_citations: [{ evidence_id: "ev-status", finding: "Provider acknowledged outage." }],
      validator_reasoning: "Evidence supports a breach.",
      recommended_next_action: "Escalate.",
      created_at: "2026-05-22T15:00:00Z",
      transaction_hash: "0xabc",
      receipt_hash: "fnv1a:12345678",
      ...overrides,
    });
  }

  it("maps a get_receipt JSON payload into an app receipt", async () => {
    await withGenLayerEnv(async () => {
      const seenRpcUrls: string[] = [];
      const verifier = createGenLayerVerifier(async (rpcUrl) => ({
        async readContract() {
          seenRpcUrls.push(rpcUrl);
          return contractReceiptJson();
        },
      }));

      const receipt = await verifier.getReceipt("case-rpc-breach-001");

      expect(receipt?.caseId).toBe("case-rpc-breach-001");
      expect(receipt?.decision).toBe("breach");
      expect(receipt?.evidenceCitations[0].evidenceId).toBe("ev-status");
      expect(seenRpcUrls).toEqual(["https://studio.genlayer.com/api"]);
    });
  });

  it("returns an on-chain receipt from verifyCase in read-mode", async () => {
    await withGenLayerEnv(async () => {
      const verifier = createGenLayerVerifier(async () => ({
        async readContract() {
          return contractReceiptJson();
        },
      }));

      const result = await verifier.verifyCase(getDemoCase("case-rpc-breach-001")!);

      expect(result.source).toBe("genlayer");
      expect(result.receipt.caseId).toBe("case-rpc-breach-001");
      expect(result.receipt.decision).toBe("breach");
      expect(result.submittedPayload).toContain('"case_id":"case-rpc-breach-001"');
    });
  });

  it("returns a gated read-mode receipt when no on-chain receipt exists", async () => {
    await withGenLayerEnv(async () => {
      const verifier = createGenLayerVerifier(async () => ({
        async readContract() {
          throw new Error("gen_call failed: receipt not found");
        },
      }));

      const result = await verifier.verifyCase(getDemoCase("case-rpc-breach-001")!);

      expect(result.source).toBe("genlayer");
      expect(result.receipt.caseId).toBe("case-rpc-breach-001");
      expect(result.receipt.decision).toBe("needs_more_evidence");
      expect(result.receipt.validatorReasoning).toContain("read-only");
    });
  });

  it("submits through GenLayer write mode and reads the finalized receipt back", async () => {
    await withGenLayerEnv(async () => {
      const txHash = `0x${"a".repeat(64)}`;
      const seenWrites: unknown[] = [];
      const seenWaits: unknown[] = [];
      const verifier = createGenLayerVerifier({
        signerFactory: () => `0x${"1".repeat(64)}`,
        pollIntervalMs: 0,
        pollRetries: 2,
        readClientFactory: async () => ({
          async readContract() {
            return contractReceiptJson({ transaction_hash: "" });
          },
        }),
        writeClientFactory: async () => ({
          async readContract() {
            return null;
          },
          async writeContract(args) {
            seenWrites.push(args);
            return txHash;
          },
          async waitForTransactionReceipt(args) {
            seenWaits.push(args);
            return {
              txExecutionResultName: ExecutionResult.FINISHED_WITH_RETURN,
              statusName: TransactionStatus.FINALIZED,
            };
          },
        }),
      });

      const result = await verifier.verifyCase(getDemoCase("case-rpc-breach-001")!);

      expect(result.receipt.decision).toBe("breach");
      expect(result.receipt.transactionHash).toBe(txHash);
      expect(seenWrites).toEqual([
        expect.objectContaining({
          address: "0x1111111111111111111111111111111111111111",
          functionName: "submit_case",
          value: 0n,
        }),
      ]);
      expect(seenWaits).toEqual([expect.objectContaining({ hash: txHash, status: "FINALIZED" })]);
    });
  });

  it("stays in read mode when live signer env is missing", async () => {
    await withGenLayerEnv(async () => {
      const verifier = createGenLayerVerifier({
        readClientFactory: async () => ({
          async readContract() {
            return contractReceiptJson();
          },
        }),
        writeClientFactory: async () => {
          throw new Error("write factory should not be called");
        },
      });

      const result = await verifier.verifyCase(getDemoCase("case-rpc-breach-001")!);

      expect(result.receipt.transactionHash).toBe("0xabc");
    });
  });

  it("uses the first non-empty GenLayer signer env alias for write mode", async () => {
    await withGenLayerEnv(async () => {
      process.env.GENLAYER_PRIVATE_KEY = "";
      process.env.GENLAYER_PRV_KEY = "   ";
      process.env.GENLAYER_PRIVKEY = `${"2".repeat(64)}`;
      const txHash = `0x${"d".repeat(64)}`;
      const seenPrivateKeys: string[] = [];
      const verifier = createGenLayerVerifier({
        pollIntervalMs: 0,
        pollRetries: 1,
        readClientFactory: async () => ({
          async readContract() {
            return contractReceiptJson();
          },
        }),
        writeClientFactory: async (_rpcUrl, privateKey) => {
          seenPrivateKeys.push(privateKey);
          return {
            async readContract() {
              return null;
            },
            async writeContract() {
              return txHash;
            },
            async waitForTransactionReceipt() {
              return {
                txExecutionResultName: ExecutionResult.FINISHED_WITH_RETURN,
                statusName: TransactionStatus.FINALIZED,
              };
            },
          };
        },
      });

      await verifier.verifyCase(getDemoCase("case-rpc-breach-001")!);

      expect(seenPrivateKeys).toEqual([`0x${"2".repeat(64)}`]);
    });
  });

  it("throws when a finalized GenLayer transaction reports an execution error", async () => {
    await withGenLayerEnv(async () => {
      const txHash = `0x${"b".repeat(64)}`;
      const verifier = createGenLayerVerifier({
        signerFactory: () => `0x${"1".repeat(64)}`,
        readClientFactory: async () => ({
          async readContract() {
            return contractReceiptJson();
          },
        }),
        writeClientFactory: async () => ({
          async readContract() {
            return null;
          },
          async writeContract() {
            return txHash;
          },
          async waitForTransactionReceipt() {
            return {
              txExecutionResultName: ExecutionResult.FINISHED_WITH_ERROR,
              statusName: TransactionStatus.FINALIZED,
            };
          },
        }),
      });

      await expect(verifier.verifyCase(getDemoCase("case-rpc-breach-001")!)).rejects.toThrow(
        `GenLayer transaction ${txHash} finished with an execution error.`,
      );
    });
  });

  it("throws when write finalizes but receipt read-back never appears", async () => {
    await withGenLayerEnv(async () => {
      const txHash = `0x${"c".repeat(64)}`;
      const verifier = createGenLayerVerifier({
        signerFactory: () => `0x${"1".repeat(64)}`,
        pollIntervalMs: 0,
        pollRetries: 1,
        readClientFactory: async () => ({
          async readContract() {
            throw new Error("gen_call failed: receipt not found");
          },
        }),
        writeClientFactory: async () => ({
          async readContract() {
            return null;
          },
          async writeContract() {
            return txHash;
          },
          async waitForTransactionReceipt() {
            return {
              txExecutionResultName: ExecutionResult.FINISHED_WITH_RETURN,
              statusName: TransactionStatus.FINALIZED,
            };
          },
        }),
      });

      await expect(verifier.verifyCase(getDemoCase("case-rpc-breach-001")!)).rejects.toThrow(
        `GenLayer transaction ${txHash} finalized, but receipt case-rpc-breach-001 is not readable yet.`,
      );
    });
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
