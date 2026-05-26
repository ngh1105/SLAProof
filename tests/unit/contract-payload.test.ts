import { describe, expect, it } from "vitest";
import {
  fromContractReceipt,
  toContractCaseJson,
  toContractPayload,
  type ContractReceipt,
} from "@/lib/genlayer/contract-payload";
import type { SlaCase } from "@/lib/domain/types";

const sampleCase: SlaCase = {
  id: "case-rpc-test-001",
  title: "Test breach",
  providerName: "Test RPC",
  chain: "ethereum-mainnet",
  endpointLabel: "test-endpoint",
  status: "ready",
  incidentWindow: { startUtc: "2026-05-22T10:00:00Z", endUtc: "2026-05-22T10:30:00Z" },
  incidentSummary: "test summary",
  slaTerms: {
    availabilityTarget: "99.9% monthly",
    errorThreshold: "5%",
    latencyThreshold: "p95<1500ms",
    exclusions: "planned maintenance",
    creditRule: "10%",
  },
  evidence: [
    {
      id: "ev-1",
      type: "status_page",
      title: "Status page",
      sourceUrl: "https://example.com/status",
      submittedExcerpt: "5xx errors at 18.6%",
      hash: "fnv1a:00000001",
    },
  ],
  createdAt: "2026-05-22T10:30:00Z",
  updatedAt: "2026-05-22T10:30:00Z",
};

const sampleReceipt: ContractReceipt = {
  version: "slaproof.receipt.v0",
  case_id: sampleCase.id,
  provider_name: sampleCase.providerName,
  chain: sampleCase.chain,
  endpoint_label: sampleCase.endpointLabel,
  decision: "breach",
  confidence: 88,
  violated_clauses: ["5% request failures"],
  evidence_citations: [{ evidence_id: "ev-1", finding: "Confirms 18.6% errors" }],
  validator_reasoning: "Sustained breach.",
  recommended_next_action: "File credit claim.",
  created_at: "2026-05-22T10:42:00Z",
  transaction_hash: "0xabc",
  receipt_hash: "fnv1a:abcdef00",
};

describe("toContractPayload", () => {
  it("snake-cases keys and preserves values", () => {
    const out = toContractPayload(sampleCase);
    expect(out.case_id).toBe(sampleCase.id);
    expect(out.provider_name).toBe(sampleCase.providerName);
    expect(out.endpoint_label).toBe(sampleCase.endpointLabel);
    expect(out.incident_window.start_utc).toBe(sampleCase.incidentWindow.startUtc);
    expect(out.sla_terms.availability_target).toBe(sampleCase.slaTerms.availabilityTarget);
    expect(out.evidence[0].submitted_excerpt).toBe(sampleCase.evidence[0].submittedExcerpt);
  });

  it("emits version tag", () => {
    expect(toContractPayload(sampleCase).version).toBe("slaproof.case.v0");
  });
});

describe("toContractCaseJson", () => {
  it("returns parseable JSON of toContractPayload", () => {
    const json = toContractCaseJson(sampleCase);
    const parsed = JSON.parse(json);
    expect(parsed.case_id).toBe(sampleCase.id);
    expect(parsed.evidence).toHaveLength(1);
  });
});

describe("fromContractReceipt", () => {
  it("camelCases keys and preserves values", () => {
    const r = fromContractReceipt(sampleReceipt);
    expect(r.caseId).toBe(sampleReceipt.case_id);
    expect(r.decision).toBe(sampleReceipt.decision);
    expect(r.confidence).toBe(sampleReceipt.confidence);
    expect(r.violatedClauses).toEqual(sampleReceipt.violated_clauses);
    expect(r.evidenceCitations[0].evidenceId).toBe(sampleReceipt.evidence_citations[0].evidence_id);
    expect(r.transactionHash).toBe(sampleReceipt.transaction_hash);
    expect(r.receiptHash).toBe(sampleReceipt.receipt_hash);
  });

  it("throws on missing version", () => {
    expect(() => fromContractReceipt({ ...sampleReceipt, version: undefined as unknown as "slaproof.receipt.v0" }))
      .toThrow(/Unsupported receipt version/);
  });

  it("throws on unsupported version", () => {
    expect(() => fromContractReceipt({ ...sampleReceipt, version: "slaproof.receipt.v99" as unknown as "slaproof.receipt.v0" }))
      .toThrow(/Unsupported receipt version/);
  });
});
