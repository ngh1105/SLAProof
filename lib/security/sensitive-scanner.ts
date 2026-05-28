// Shared sensitive-data scanner used by case payload validation and
// receipt export redaction.
//
// Patterns are conservative — false positives are preferred over leaking a
// real credential into a published receipt. When a pattern fires we either
// reject (server-side validation) or replace the match with a redaction
// marker (export pipeline).

export type SensitivePattern = {
  pattern: RegExp;
  message: string;
  marker: string;
};

export const SENSITIVE_PATTERNS: SensitivePattern[] = [
  {
    // Word-boundary lookbehind/lookahead so we don't redact a 64-hex tx hash
    // embedded in a longer identifier (e.g. URL slug or compound id) and so
    // the boundary characters survive the replace.
    pattern: /(?<=^|[\s"'(])(?:0x)?[0-9a-fA-F]{64}(?=[\s"')]|$)/g,
    message: "Potential 32-byte Private Key",
    marker: "[REDACTED:private-key-like]",
  },
  {
    pattern: /sk_(?:live|test)_[0-9a-zA-Z]{24}/g,
    message: "Stripe Secret API Key",
    marker: "[REDACTED:stripe-key]",
  },
  {
    pattern: /AIzaSy[0-9a-zA-Z\-_]{33}/g,
    message: "Google API Key",
    marker: "[REDACTED:google-api-key]",
  },
  {
    pattern: /authorization:\s*(?:bearer|basic)\s+[0-9a-zA-Z+/=_-]+/gi,
    message: "Authorization header",
    marker: "[REDACTED:authorization-header]",
  },
  {
    pattern: /AKIA[0-9A-Z]{16}/g,
    message: "AWS Access Key ID",
    marker: "[REDACTED:aws-key]",
  },
  {
    pattern: /gh[pos]_[0-9a-zA-Z]{36}/g,
    message: "GitHub personal access / OAuth / Apps token",
    marker: "[REDACTED:github-token]",
  },
  {
    pattern: /xox[baprs]-[0-9a-zA-Z-]{10,}/g,
    message: "Slack token",
    marker: "[REDACTED:slack-token]",
  },
  {
    pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
    message: "JWT",
    marker: "[REDACTED:jwt]",
  },
  {
    // Match the entire PEM block including the END marker so the body and
    // trailer never survive into an exported receipt. `[\s\S]*?` is lazy and
    // the `|$` fallback handles truncated logs that ship the header without
    // a closing marker.
    pattern:
      /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----|$)/g,
    message: "Private key block",
    marker: "[REDACTED:private-key-block]",
  },
  {
    pattern:
      /(password|passwd|secret|api[_-]?key)\s*[=:]\s*["']?[A-Za-z0-9!@#$%^&*_\-+=]{8,}["']?/gi,
    message: "Possible password / secret assignment",
    marker: "[REDACTED:secret-assignment]",
  },
];

export type SensitiveFinding = {
  message: string;
};

// Each call gets a fresh regex so the /g flag's `lastIndex` state never
// leaks across pattern probes.
function freshRegex(p: RegExp): RegExp {
  return new RegExp(p.source, p.flags);
}

export function scanText(text: string): SensitiveFinding[] {
  if (!text) return [];
  const findings: SensitiveFinding[] = [];
  for (const { pattern, message } of SENSITIVE_PATTERNS) {
    if (freshRegex(pattern).test(text)) findings.push({ message });
  }
  return findings;
}

export function redactSensitiveText(text: string): {
  text: string;
  redactions: string[];
} {
  if (!text) return { text, redactions: [] };
  let out = text;
  const redactions: string[] = [];
  for (const { pattern, marker, message } of SENSITIVE_PATTERNS) {
    const re = freshRegex(pattern);
    if (re.test(out)) {
      redactions.push(message);
      // Re-create regex because /g `test()` advanced `lastIndex`.
      out = out.replace(freshRegex(pattern), marker);
    }
  }
  return { text: out, redactions };
}
