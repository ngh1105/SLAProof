import { hashReceipt } from "@/lib/domain/hash";
import { validateSlaCase } from "@/lib/domain/validation";
import type { Receipt, SlaCase, VerdictDecision } from "@/lib/domain/types";

const decisionCopy: Record<
  VerdictDecision,
  Pick<Receipt, "validatorReasoning" | "recommendedNextAction" | "confidence" | "violatedClauses">
> = {
  breach: {
    confidence: 88,
    violatedClauses: ["5% request failures for 5+ consecutive minutes"],
    validatorReasoning:
      "Provider acknowledgement and probe summary overlap the incident window and exceed the stated request-failure threshold.",
    recommendedNextAction:
      "Open a vendor service credit claim with the receipt, probe summary, and status page citation attached.",
  },
  no_breach: {
    confidence: 81,
    violatedClauses: [],
    validatorReasoning:
      "Evidence shows degraded performance, but duration and failure rate remain below the SLA breach threshold.",
    recommendedNextAction:
      "Keep the incident in the postmortem, but do not escalate as an SLA credit claim unless new data appears.",
  },
  inconclusive: {
    confidence: 54,
    violatedClauses: [],
    validatorReasoning:
      "Evidence points to possible stale reads, but the record lacks request totals, consistent timestamps, or provider acknowledgement.",
    recommendedNextAction:
      "Collect a probe summary with request volume, UTC timestamps, and provider status or support confirmation.",
  },
  needs_more_evidence: {
    confidence: 25,
    violatedClauses: [],
    validatorReasoning:
      "Required SLA thresholds and corroborating evidence are missing, so the case cannot be evaluated yet.",
    recommendedNextAction:
      "Add the SLA clause, a status page or support reference, and a monitoring summary before submission.",
  },
};

export function inferMockDecision(slaCase: SlaCase): VerdictDecision {
  const validation = validateSlaCase(slaCase);

  if (!validation.valid) {
    return "needs_more_evidence";
  }

  const text = [
    slaCase.incidentSummary,
    slaCase.slaTerms.errorThreshold,
    ...slaCase.evidence.map((item) => `${item.title} ${item.submittedExcerpt}`),
  ]
    .join(" ")
    .toLowerCase();

  if (
    text.includes("18.6%") ||
    text.includes("elevated 5xx") ||
    text.includes("sustained 5xx")
  ) {
    return "breach";
  }

  if (
    text.includes("under 3%") ||
    text.includes("below the provider") ||
    text.includes("below threshold")
  ) {
    return "no_breach";
  }

  if (slaCase.evidence.length < 2) {
    return "needs_more_evidence";
  }

  return "inconclusive";
}

export function verifyCaseLocally(slaCase: SlaCase): Receipt {
  const decision = inferMockDecision(slaCase);
  const copy = decisionCopy[decision];
  const createdAt = "2026-05-22T15:00:00Z";
  const receiptWithoutHash: Omit<Receipt, "receiptHash"> = {
    version: "slaproof.receipt.v0",
    caseId: slaCase.id,
    decision,
    confidence: copy.confidence,
    violatedClauses: copy.violatedClauses,
    evidenceCitations: slaCase.evidence.slice(0, 3).map((item) => ({
      evidenceId: item.id,
      finding:
        decision === "needs_more_evidence"
          ? "Evidence is present but not enough to evaluate the SLA threshold."
          : `${item.title} contributes to the ${decision.replace("_", " ")} assessment.`,
    })),
    validatorReasoning: copy.validatorReasoning,
    recommendedNextAction: copy.recommendedNextAction,
    createdAt,
    contractAddress: "mock:local-demo",
    transactionHash: `mock:${slaCase.id}`,
  };

  return {
    ...receiptWithoutHash,
    receiptHash: hashReceipt(receiptWithoutHash),
  };
}

