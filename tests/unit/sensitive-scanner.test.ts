import { describe, expect, it } from "vitest";
import { redactSensitiveText, scanText } from "@/lib/security/sensitive-scanner";

describe("scanText", () => {
  it("returns no findings for clean text", () => {
    expect(scanText("nothing sensitive here")).toEqual([]);
  });

  it("flags JWT", () => {
    const f = scanText("auth: eyJabcdefghijk.eyJabcdefghijk.eyJabcdefghijk");
    expect(f.some((x) => /JWT/i.test(x.message))).toBe(true);
  });

  it("flags Stripe live key", () => {
    const f = scanText("sk_live_abcdefghijklmnopqrstuvwx");
    expect(f.some((x) => /Stripe/i.test(x.message))).toBe(true);
  });
});

describe("redactSensitiveText", () => {
  it("returns input unchanged when no findings", () => {
    const r = redactSensitiveText("hello world");
    expect(r.text).toBe("hello world");
    expect(r.redactions).toEqual([]);
  });

  it("replaces Stripe keys with marker", () => {
    const r = redactSensitiveText("token sk_live_abcdefghijklmnopqrstuvwx end");
    expect(r.text).toContain("[REDACTED:stripe-key]");
    expect(r.text).not.toContain("sk_live_abcdefghijklmnopqrstuvwx");
    expect(r.redactions.length).toBe(1);
  });

  it("collapses multiple JWTs into one redaction marker per match", () => {
    const r = redactSensitiveText(
      "a eyJaaaaaaaaaa.eyJaaaaaaaaaa.eyJaaaaaaaaaa b eyJbbbbbbbbbb.eyJbbbbbbbbbb.eyJbbbbbbbbbb",
    );
    const matches = r.text.match(/\[REDACTED:jwt\]/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("redacts PEM private key blocks", () => {
    const r = redactSensitiveText(
      "log: -----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAA",
    );
    expect(r.text).toContain("[REDACTED:private-key-block]");
    expect(r.text).not.toContain("BEGIN RSA PRIVATE KEY");
  });

  it("does not flag normal hex shorter than 64 chars", () => {
    const r = redactSensitiveText("hash 0xabc123");
    expect(r.redactions).toEqual([]);
  });

  it("redacts a bare 64-hex private key but preserves whitespace boundaries", () => {
    const r = redactSensitiveText(
      `pk 0x${"a".repeat(64)} continues`,
    );
    expect(r.text).toContain("[REDACTED:private-key-like]");
    expect(r.text.startsWith("pk ")).toBe(true);
    expect(r.text.endsWith(" continues")).toBe(true);
    expect(r.redactions).toEqual(["Potential 32-byte Private Key"]);
  });

  it("does NOT redact a 64-hex transaction hash embedded inside an identifier", () => {
    // Real receipts cite tx ids inline, e.g. via Markdown link slugs or
    // file paths — those should survive the export scrub untouched.
    const txish = `0x${"d".repeat(64)}`;
    const r = redactSensitiveText(`tx-hash:${txish}-confirmed`);
    expect(r.redactions).toEqual([]);
    expect(r.text).toBe(`tx-hash:${txish}-confirmed`);
  });
});
