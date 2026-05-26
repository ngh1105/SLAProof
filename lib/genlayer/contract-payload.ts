import type { EvidenceItem, Receipt, SlaCase } from "@/lib/domain/types";
import { checkReceiptVersion } from "@/lib/domain/receipt-versions";

export type ContractEvidenceItem = {
  id: string;
  type: EvidenceItem["type"];
  title: string;
  source_url?: string;
  submitted_excerpt: string;
  time_range?: string;
  hash: string;
  notes?: string;
};

export type ContractCasePayload = {
  version: "slaproof.case.v0";
  case_id: string;
  provider_name: string;
  chain: string;
  endpoint_label: string;
  incident_window: {
    start_utc: string;
    end_utc: string;
  };
  incident_summary: string;
  sla_terms: {
    availability_target: string;
    error_threshold: string;
    latency_threshold: string;
    exclusions: string;
    credit_rule: string;
    document_url?: string;
  };
  evidence: ContractEvidenceItem[];
};

export type ContractReceipt = {
  version: "slaproof.receipt.v0";
  case_id: string;
  provider_name?: string;
  chain?: string;
  endpoint_label?: string;
  decision: Receipt["decision"];
  confidence: number;
  violated_clauses: string[];
  evidence_citations: Array<{
    evidence_id: string;
    finding: string;
  }>;
  validator_reasoning: string;
  recommended_next_action: string;
  created_at: string;
  transaction_hash?: string;
  receipt_hash: string;
  validation_errors?: string[];
  validation_warnings?: string[];
};

export function toContractPayload(slaCase: SlaCase): ContractCasePayload {
  return {
    version: "slaproof.case.v0",
    case_id: slaCase.id,
    provider_name: slaCase.providerName,
    chain: slaCase.chain,
    endpoint_label: slaCase.endpointLabel,
    incident_window: {
      start_utc: slaCase.incidentWindow.startUtc,
      end_utc: slaCase.incidentWindow.endUtc,
    },
    incident_summary: slaCase.incidentSummary,
    sla_terms: {
      availability_target: slaCase.slaTerms.availabilityTarget,
      error_threshold: slaCase.slaTerms.errorThreshold,
      latency_threshold: slaCase.slaTerms.latencyThreshold,
      exclusions: slaCase.slaTerms.exclusions,
      credit_rule: slaCase.slaTerms.creditRule,
      document_url: slaCase.slaTerms.documentUrl,
    },
    evidence: slaCase.evidence.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      source_url: item.sourceUrl,
      submitted_excerpt: item.submittedExcerpt,
      time_range: item.timeRange,
      hash: item.hash,
      notes: item.notes,
    })),
  };
}

export function toContractCaseJson(slaCase: SlaCase): string {
  return JSON.stringify(toContractPayload(slaCase));
}

export function fromContractReceipt(receipt: ContractReceipt): Receipt {
  const versionCheck = checkReceiptVersion(receipt as { version?: unknown });
  if (!versionCheck.ok) {
    throw new Error(
      `Unsupported receipt version (${versionCheck.reason}): ${String(versionCheck.observed)}`,
    );
  }
  return {
    version: receipt.version,
    caseId: receipt.case_id,
    decision: receipt.decision,
    confidence: receipt.confidence,
    violatedClauses: receipt.violated_clauses,
    evidenceCitations: receipt.evidence_citations.map((citation) => ({
      evidenceId: citation.evidence_id,
      finding: citation.finding,
    })),
    validatorReasoning: receipt.validator_reasoning,
    recommendedNextAction: receipt.recommended_next_action,
    createdAt: receipt.created_at,
    transactionHash: receipt.transaction_hash,
    receiptHash: receipt.receipt_hash,
  };
}

