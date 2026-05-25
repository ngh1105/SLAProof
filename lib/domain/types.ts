export type VerdictDecision =
  | "breach"
  | "no_breach"
  | "inconclusive"
  | "needs_more_evidence";

export type CaseStatus = "draft" | "ready" | "pending" | "finalized" | "failed";

export type EvidenceType =
  | "status_page"
  | "monitoring_summary"
  | "error_sample"
  | "vendor_postmortem"
  | "support_thread"
  | "community_report"
  | "other";

export type IncidentWindow = {
  startUtc: string;
  endUtc: string;
};

export type SlaTerms = {
  availabilityTarget: string;
  errorThreshold: string;
  latencyThreshold: string;
  exclusions: string;
  creditRule: string;
  documentUrl?: string;
};

export type EvidenceItem = {
  id: string;
  type: EvidenceType;
  title: string;
  sourceUrl?: string;
  submittedExcerpt: string;
  timeRange?: string;
  hash: string;
  notes?: string;
};

export type SlaCase = {
  id: string;
  title: string;
  providerName: string;
  chain: string;
  endpointLabel: string;
  status: CaseStatus;
  incidentWindow: IncidentWindow;
  incidentSummary: string;
  slaTerms: SlaTerms;
  evidence: EvidenceItem[];
  createdAt: string;
  updatedAt: string;
};

export type EvidenceCitation = {
  evidenceId: string;
  finding: string;
};

export type Receipt = {
  version: "slaproof.receipt.v0";
  caseId: string;
  decision: VerdictDecision;
  confidence: number;
  violatedClauses: string[];
  evidenceCitations: EvidenceCitation[];
  validatorReasoning: string;
  recommendedNextAction: string;
  createdAt: string;
  contractAddress?: string;
  transactionHash?: string;
  receiptHash: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

