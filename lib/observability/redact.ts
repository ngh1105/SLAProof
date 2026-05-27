// Shared redaction utility used by audit-log and error-reporter.
//
// Extracted into its own module so client-side consumers (e.g.
// app/error.tsx via reportError) don't pull in the node:fs import that
// audit-log brings.

const REDACT_KEYS = [
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apiKey",
  "privateKey",
  "private_key",
  "authorization",
  "cookie",
  "session",
];

function isSensitiveKey(key: string): boolean {
  const lc = key.toLowerCase();
  return REDACT_KEYS.some((k) => lc.includes(k.toLowerCase()));
}

export function redactDetails(
  input: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isSensitiveKey(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redactDetails(value as Record<string, unknown>);
      continue;
    }
    if (typeof value === "string" && value.length > 500) {
      out[key] = `${value.slice(0, 500)}...[truncated ${value.length - 500} chars]`;
      continue;
    }
    out[key] = value;
  }
  return out;
}
