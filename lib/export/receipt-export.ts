import { getDemoCase } from "@/lib/domain/fixtures";
import type { Receipt } from "@/lib/domain/types";

export function exportReceiptJson(receipt: Receipt): string {
  return `${JSON.stringify(receipt, null, 2)}\n`;
}

export function exportReceiptMarkdown(receipt: Receipt): string {
  const slaCase = getDemoCase(receipt.caseId);
  const title = slaCase?.title ?? receipt.caseId;
  const citations = receipt.evidenceCitations
    .map((citation) => `- ${citation.evidenceId}: ${citation.finding}`)
    .join("\n");
  const clauses =
    receipt.violatedClauses.length > 0
      ? receipt.violatedClauses.map((clause) => `- ${clause}`).join("\n")
      : "- None";

  return [
    `# SLAProof Receipt: ${title}`,
    "",
    `Decision: ${receipt.decision}`,
    `Confidence: ${receipt.confidence}%`,
    `Case ID: ${receipt.caseId}`,
    `Receipt hash: ${receipt.receiptHash}`,
    "",
    "## Violated Clauses",
    clauses,
    "",
    "## Evidence Citations",
    citations,
    "",
    "## Reasoning",
    receipt.validatorReasoning,
    "",
    "## Recommended Next Action",
    receipt.recommendedNextAction,
    "",
  ].join("\n");
}

