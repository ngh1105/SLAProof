// Startup-time env validation. Fails fast in production when required
// configuration is missing or malformed. Dev mode logs warnings instead.
//
// Call validateEnv() at process boot (e.g., from instrumentation.ts) so
// misconfiguration surfaces before traffic arrives.

export type EnvIssue = { key: string; reason: string; level: "error" | "warn" };

export type EnvValidationResult = {
  ok: boolean;
  issues: EnvIssue[];
};

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

export function validateEnv(env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const issues: EnvIssue[] = [];
  const isProd = env.NODE_ENV === "production";

  const verifierMode = (env.NEXT_PUBLIC_SLAPROOF_VERIFIER ?? "mock").toLowerCase();
  if (verifierMode === "genlayer") {
    requireString(env, "NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS", issues, HEX_ADDRESS, "must be a 0x-prefixed 40-char hex address");
    requireString(env, "NEXT_PUBLIC_GENLAYER_RPC_URL", issues, URL_PATTERN, "must be an http(s) URL");
    requireString(env, "NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL", issues);
    requireNumber(env, "NEXT_PUBLIC_SLAPROOF_CHAIN_ID", issues);
  }

  if (isProd) {
    if (!env.PILOT_TOKEN || env.PILOT_TOKEN.length < 16) {
      issues.push({ key: "PILOT_TOKEN", reason: "must be at least 16 chars in production", level: "error" });
    }
  } else if (env.PILOT_TOKEN && env.PILOT_TOKEN.length < 16) {
    issues.push({ key: "PILOT_TOKEN", reason: "is short (<16 chars)", level: "warn" });
  }

  return {
    ok: issues.every((i) => i.level !== "error"),
    issues,
  };
}

function requireString(
  env: NodeJS.ProcessEnv,
  key: string,
  issues: EnvIssue[],
  pattern?: RegExp,
  patternMessage?: string,
): void {
  const value = env[key];
  if (!value || value.trim() === "") {
    issues.push({ key, reason: "is required", level: "error" });
    return;
  }
  if (pattern && !pattern.test(value)) {
    issues.push({ key, reason: patternMessage ?? `does not match ${pattern}`, level: "error" });
  }
}

function requireNumber(env: NodeJS.ProcessEnv, key: string, issues: EnvIssue[]): void {
  const value = env[key];
  if (!value) {
    issues.push({ key, reason: "is required", level: "error" });
    return;
  }
  if (Number.isNaN(Number(value))) {
    issues.push({ key, reason: "must be numeric", level: "error" });
  }
}
