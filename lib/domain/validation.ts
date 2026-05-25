import type { SlaCase, ValidationResult } from "./types";

export function validateSlaCase(slaCase: SlaCase): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const start = Date.parse(slaCase.incidentWindow.startUtc);
  const end = Date.parse(slaCase.incidentWindow.endUtc);

  if (!slaCase.providerName.trim()) errors.push("Provider name is required.");
  if (!slaCase.chain.trim()) errors.push("Chain is required.");
  if (!slaCase.endpointLabel.trim()) errors.push("Endpoint label is required.");
  if (!slaCase.incidentSummary.trim()) errors.push("Incident summary is required.");

  if (Number.isNaN(start) || Number.isNaN(end)) {
    errors.push("Incident window must use valid UTC timestamps.");
  } else if (start >= end) {
    errors.push("Incident start must be before incident end.");
  }

  if (!slaCase.slaTerms.errorThreshold.trim() && !slaCase.slaTerms.availabilityTarget.trim()) {
    errors.push("At least one measurable SLA threshold is required.");
  }

  if (slaCase.evidence.length < 2) {
    warnings.push("Add at least two evidence items before asking for a live verdict.");
  }

  const ids = new Set<string>();
  for (const item of slaCase.evidence) {
    if (ids.has(item.id)) {
      errors.push(`Duplicate evidence id: ${item.id}.`);
    }
    ids.add(item.id);

    if (!item.submittedExcerpt.trim()) {
      errors.push(`Evidence ${item.id} needs an excerpt.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function formatUtcRange(slaCase: Pick<SlaCase, "incidentWindow">): string {
  const start = new Date(slaCase.incidentWindow.startUtc);
  const end = new Date(slaCase.incidentWindow.endUtc);

  return `${start.toISOString().replace(".000Z", "Z")} to ${end
    .toISOString()
    .replace(".000Z", "Z")}`;
}

