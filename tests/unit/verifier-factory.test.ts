import { afterEach, describe, expect, it } from "vitest";
import { getVerifier, getVerifierMode, getVerifierReadiness } from "@/lib/verifier";

describe("verifier factory", () => {
  const original = process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER;
    else process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER = original;
  });

  it("defaults to mock when env var is unset", () => {
    delete process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER;
    expect(getVerifierMode()).toBe("mock");
  });

  it("defaults to mock for unrecognised values", () => {
    process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER = "wat";
    expect(getVerifierMode()).toBe("mock");
  });

  it("returns genlayer when env var is exactly 'genlayer'", () => {
    process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER = "genlayer";
    expect(getVerifierMode()).toBe("genlayer");
  });

  it("getVerifier returns an object with readiness, getReceipt, verifyCase", () => {
    delete process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER;
    const v = getVerifier();
    expect(v.readiness).toBeDefined();
    expect(typeof v.getReceipt).toBe("function");
    expect(typeof v.verifyCase).toBe("function");
  });

  it("getVerifierReadiness mirrors the active verifier mode", () => {
    delete process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER;
    expect(getVerifierReadiness().mode).toBe("mock");
    expect(getVerifierReadiness().ready).toBe(true);
  });

  it("genlayer mode reports degraded when env vars missing", () => {
    process.env.NEXT_PUBLIC_SLAPROOF_VERIFIER = "genlayer";
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL = "";
    process.env.NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS = "";
    const r = getVerifierReadiness();
    expect(r.mode).toBe("genlayer");
    expect(r.ready).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
  });
});
