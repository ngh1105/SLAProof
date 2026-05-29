import { getDemoCase } from "@/lib/domain/fixtures";
import type { Receipt } from "@/lib/domain/types";
import { increment } from "@/lib/observability/metrics";
import { log } from "@/lib/observability/logger";
import { redactReceiptForExport } from "@/lib/export/receipt-redaction";

function prepareForExport(receipt: Receipt): Receipt {
  const { receipt: safe, redactions } = redactReceiptForExport(receipt);
  if (redactions.length > 0) {
    increment("export_receipt_redacted");
    log.warn("export_receipt_redacted", {
      caseId: receipt.caseId,
      patterns: redactions,
    });
  }
  return safe;
}

export function exportReceiptJson(receipt: Receipt): string {
  increment("export_receipt_json");
  const safe = prepareForExport(receipt);
  return `${JSON.stringify(safe, null, 2)}\n`;
}

export async function exportReceiptMarkdown(receipt: Receipt): Promise<string> {
  increment("export_receipt_markdown");
  const safe = prepareForExport(receipt);
  const slaCase = await getDemoCase(safe.caseId);
  const title = slaCase?.title ?? safe.caseId;
  const citations = safe.evidenceCitations
    .map((citation) => `- ${citation.evidenceId}: ${citation.finding}`)
    .join("\n");
  const clauses =
    safe.violatedClauses.length > 0
      ? safe.violatedClauses.map((clause) => `- ${clause}`).join("\n")
      : "- None";

  return [
    `# SLAProof Receipt: ${title}`,
    "",
    `Decision: ${safe.decision}`,
    `Confidence: ${safe.confidence}%`,
    `Case ID: ${safe.caseId}`,
    `Receipt hash: ${safe.receiptHash}`,
    "",
    "## Violated Clauses",
    clauses,
    "",
    "## Evidence Citations",
    citations,
    "",
    "## Reasoning",
    safe.validatorReasoning,
    "",
    "## Recommended Next Action",
    safe.recommendedNextAction,
    "",
  ].join("\n");
}

