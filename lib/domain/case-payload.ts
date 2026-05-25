import type { EvidenceItem, EvidenceType, SlaCase } from "./types";
import { validateSlaCase } from "./validation";

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /(?:^|\s|["'])(?:0x)?[0-9a-fA-F]{64}(?:\s|["']|$)/,
    message:
      "Potential 32-byte Private Key detected. Do NOT submit private keys.",
  },
  {
    pattern: /sk_(?:live|test)_[0-9a-zA-Z]{24}/,
    message: "Stripe Secret API Key detected. Redact credentials before submission.",
  },
  {
    pattern: /AIzaSy[0-9a-zA-Z\-_]{33}/,
    message: "Google API Key detected. Redact credentials before submission.",
  },
  {
    pattern: /authorization:\s*(?:bearer|basic)\s+[0-9a-zA-Z+/=_-]+/i,
    message: "Authorization Token detected. Redact headers before submission.",
  },
];

function scanText(text: string): string[] {
  if (!text) return [];
  const findings: string[] = [];
  for (const { pattern, message } of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) findings.push(message);
  }
  return findings;
}

export function scanCaseForSensitiveData(slaCase: SlaCase): string[] {
  const findings: string[] = [];
  for (const item of slaCase.evidence) {
    findings.push(...scanText(item.submittedExcerpt));
  }
  return findings;
}

export type CasePayloadResult =
  | { ok: true; case: SlaCase }
  | { ok: false; errors: string[] };

const VALID_EVIDENCE_TYPES: EvidenceType[] = [
  "status_page",
  "monitoring_summary",
  "error_sample",
  "vendor_postmortem",
  "support_thread",
  "community_report",
  "other",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function shapeErrors(input: unknown): string[] {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return ["Payload must be a JSON object."];
  }

  const required: Array<keyof SlaCase> = [
    "id",
    "title",
    "providerName",
    "chain",
    "endpointLabel",
    "incidentSummary",
  ];
  for (const key of required) {
    if (!isString(input[key as string])) {
      errors.push(`Field "${String(key)}" must be a string.`);
    }
  }

  const win = input["incidentWindow"];
  if (!isPlainObject(win) || !isString(win["startUtc"]) || !isString(win["endUtc"])) {
    errors.push('Field "incidentWindow" must contain string startUtc/endUtc.');
  }

  const terms = input["slaTerms"];
  if (!isPlainObject(terms)) {
    errors.push('Field "slaTerms" must be an object.');
  }

  const evidence = input["evidence"];
  if (!Array.isArray(evidence)) {
    errors.push('Field "evidence" must be an array.');
  } else {
    evidence.forEach((item, idx) => {
      if (!isPlainObject(item)) {
        errors.push(`Evidence #${idx} must be an object.`);
        return;
      }
      if (!isString(item["id"])) errors.push(`Evidence #${idx} missing string id.`);
      if (!isString(item["title"])) errors.push(`Evidence #${idx} missing string title.`);
      if (!isString(item["submittedExcerpt"])) {
        errors.push(`Evidence #${idx} missing string submittedExcerpt.`);
      }
      const type = item["type"];
      if (!isString(type) || !VALID_EVIDENCE_TYPES.includes(type as EvidenceType)) {
        errors.push(`Evidence #${idx} has invalid type "${String(type)}".`);
      }
    });
  }

  return errors;
}

export function validateCasePayload(input: unknown): CasePayloadResult {
  const shape = shapeErrors(input);
  if (shape.length > 0) {
    return { ok: false, errors: shape };
  }

  const slaCase = input as SlaCase;

  const sensitive = scanCaseForSensitiveData(slaCase);
  if (sensitive.length > 0) {
    return {
      ok: false,
      errors: sensitive.map((m) => `Sensitive credential detected: ${m}`),
    };
  }

  const domain = validateSlaCase(slaCase);
  if (!domain.valid) {
    return { ok: false, errors: domain.errors };
  }

  const normalized: SlaCase = {
    ...slaCase,
    evidence: slaCase.evidence.map(
      (item): EvidenceItem => ({
        ...item,
        type: item.type as EvidenceType,
      }),
    ),
  };

  return { ok: true, case: normalized };
}
