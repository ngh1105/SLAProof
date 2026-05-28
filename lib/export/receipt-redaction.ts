// Receipt export redaction.
//
// Receipts are designed to be shareable artifacts (vendor escalation,
// service-credit claims, audit). Anything that the verifier produced is
// inherently safe to publish, but the receipt body still ships free-text
// fields (`validatorReasoning`, `recommendedNextAction`, evidence
// citations) that downstream callers may have populated from
// user-supplied excerpts.
//
// To eliminate the risk that a future verifier or human edit slips a
// secret into one of those fields, every export goes through a
// pattern-based scrub before it is rendered.
//
// Production threat model item P3 (closes the manual-review checklist
// gate in `production-readiness-checklist.md`).

import type { Receipt } from "@/lib/domain/types";
import { redactSensitiveText } from "@/lib/security/sensitive-scanner";

export type ReceiptRedactionResult = {
  receipt: Receipt;
  redactions: string[];
};

function redactString(value: string, sink: Set<string>): string {
  const { text, redactions } = redactSensitiveText(value);
  for (const m of redactions) sink.add(m);
  return text;
}

export function redactReceiptForExport(receipt: Receipt): ReceiptRedactionResult {
  const redactions = new Set<string>();
  const safe: Receipt = {
    ...receipt,
    validatorReasoning: redactString(receipt.validatorReasoning, redactions),
    recommendedNextAction: redactString(receipt.recommendedNextAction, redactions),
    violatedClauses: receipt.violatedClauses.map((clause) =>
      redactString(clause, redactions),
    ),
    evidenceCitations: receipt.evidenceCitations.map((citation) => ({
      evidenceId: redactString(citation.evidenceId, redactions),
      finding: redactString(citation.finding, redactions),
    })),
  };
  return { receipt: safe, redactions: Array.from(redactions) };
}
