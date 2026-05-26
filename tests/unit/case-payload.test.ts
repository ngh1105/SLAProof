import { describe, expect, it } from "vitest";
import {
  scanCaseForSensitiveData,
  validateCasePayload,
} from "@/lib/domain/case-payload";
import { getDemoCase } from "@/lib/storage/case-store";

function validSeed() {
  const seed = getDemoCase("case-rpc-breach-001");
  if (!seed) throw new Error("seed missing");
  return seed;
}

describe("scanCaseForSensitiveData", () => {
  it("flags Stripe-style secret keys in evidence excerpts", () => {
    const seed = validSeed();
    const tampered = {
      ...seed,
      evidence: [
        {
          ...seed.evidence[0],
          submittedExcerpt: "log line containing sk_live_aaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    };

    const findings = scanCaseForSensitiveData(tampered);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings.join(" ")).toMatch(/Stripe/i);
  });

  it("flags 64-char hex private keys", () => {
    const seed = validSeed();
    const tampered = {
      ...seed,
      evidence: [
        {
          ...seed.evidence[0],
          submittedExcerpt:
            "key 0x" + "a".repeat(64),
        },
      ],
    };

    expect(scanCaseForSensitiveData(tampered).join(" ")).toMatch(/Private Key/i);
  });

  it("returns no findings when excerpts are clean", () => {
    expect(scanCaseForSensitiveData(validSeed())).toEqual([]);
  });
});

describe("validateCasePayload", () => {
  it("returns ok=true for a clean valid payload", () => {
    const result = validateCasePayload(validSeed());
    expect(result.ok).toBe(true);
  });

  it("rejects payloads that are not a plain object", () => {
    expect(validateCasePayload(null).ok).toBe(false);
    expect(validateCasePayload("not a case").ok).toBe(false);
    expect(validateCasePayload(42).ok).toBe(false);
  });

  it("rejects payloads missing required scalar fields", () => {
    const seed = validSeed();
    const result = validateCasePayload({ ...seed, providerName: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /provider/i.test(e))).toBe(true);
    }
  });

  it("rejects payloads whose evidence excerpts contain sensitive credentials", () => {
    const seed = validSeed();
    const tampered = {
      ...seed,
      evidence: [
        {
          ...seed.evidence[0],
          submittedExcerpt: "leaked sk_live_abcdefghijklmnopqrstuvwx",
        },
        ...seed.evidence.slice(1),
      ],
    };
    const result = validateCasePayload(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /sensitive|stripe/i.test(e))).toBe(true);
    }
  });

  it("rejects payloads whose incident window has invalid timestamps", () => {
    const seed = validSeed();
    const tampered = {
      ...seed,
      incidentWindow: { startUtc: "not a date", endUtc: "also not a date" },
    };
    const result = validateCasePayload(tampered);
    expect(result.ok).toBe(false);
  });
});

describe("scanCaseForSensitiveData expanded patterns", () => {
  it("flags AWS access key id", () => {
    const seed = validSeed();
    seed.evidence[0].submittedExcerpt = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
    const f = scanCaseForSensitiveData(seed);
    expect(f.some((m) => /AWS Access Key/.test(m))).toBe(true);
  });

  it("flags GitHub personal access token (ghp_)", () => {
    const seed = validSeed();
    seed.evidence[0].submittedExcerpt = "token=ghp_" + "a".repeat(36);
    const f = scanCaseForSensitiveData(seed);
    expect(f.some((m) => /GitHub personal access/.test(m))).toBe(true);
  });

  it("flags Slack token", () => {
    const seed = validSeed();
    seed.evidence[0].submittedExcerpt = "header X-Slack: xoxb-1234567890-token-value";
    const f = scanCaseForSensitiveData(seed);
    expect(f.some((m) => /Slack token/.test(m))).toBe(true);
  });

  it("flags JWT", () => {
    const seed = validSeed();
    seed.evidence[0].submittedExcerpt =
      "auth: eyJhbGciOiJIUzI1NiIs.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturepart_xxxxxxxxxxxx";
    const f = scanCaseForSensitiveData(seed);
    expect(f.some((m) => /JWT detected/.test(m))).toBe(true);
  });

  it("flags PEM private key block", () => {
    const seed = validSeed();
    seed.evidence[0].submittedExcerpt =
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...";
    const f = scanCaseForSensitiveData(seed);
    expect(f.some((m) => /Private key block/.test(m))).toBe(true);
  });

  it("flags password assignment", () => {
    const seed = validSeed();
    seed.evidence[0].submittedExcerpt = "password = supersecret123";
    const f = scanCaseForSensitiveData(seed);
    expect(f.some((m) => /password|secret/i.test(m))).toBe(true);
  });
});
