import { describe, expect, it } from "vitest";
import { validateEnv } from "@/lib/config/env-validation";

describe("validateEnv", () => {
  it("ok when verifier=mock and no other vars", () => {
    const result = validateEnv({ NEXT_PUBLIC_SLAPROOF_VERIFIER: "mock" } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(true);
  });

  it("ok with full genlayer config", () => {
    const result = validateEnv({
      NEXT_PUBLIC_SLAPROOF_VERIFIER: "genlayer",
      NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS: "0x" + "a".repeat(40),
      NEXT_PUBLIC_GENLAYER_RPC_URL: "https://studio.genlayer.com/api",
      NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL: "Studionet",
      NEXT_PUBLIC_SLAPROOF_CHAIN_ID: "61999",
    } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("flags malformed contract address in genlayer mode", () => {
    const result = validateEnv({
      NEXT_PUBLIC_SLAPROOF_VERIFIER: "genlayer",
      NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS: "not-an-address",
      NEXT_PUBLIC_GENLAYER_RPC_URL: "https://studio.genlayer.com/api",
      NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL: "Studionet",
      NEXT_PUBLIC_SLAPROOF_CHAIN_ID: "61999",
    } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(result.issues.find((i) => i.key === "NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS")).toBeDefined();
  });

  it("flags non-numeric chain id", () => {
    const result = validateEnv({
      NEXT_PUBLIC_SLAPROOF_VERIFIER: "genlayer",
      NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS: "0x" + "b".repeat(40),
      NEXT_PUBLIC_GENLAYER_RPC_URL: "https://studio.genlayer.com/api",
      NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL: "Studionet",
      NEXT_PUBLIC_SLAPROOF_CHAIN_ID: "abc",
    } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(result.issues.find((i) => i.key === "NEXT_PUBLIC_SLAPROOF_CHAIN_ID")?.reason).toMatch(/numeric/);
  });

  it("requires PILOT_TOKEN in production", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_SLAPROOF_VERIFIER: "mock",
    } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(result.issues.find((i) => i.key === "PILOT_TOKEN")).toBeDefined();
  });

  it("warns (not errors) on short PILOT_TOKEN in dev", () => {
    const result = validateEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_SLAPROOF_VERIFIER: "mock",
      PILOT_TOKEN: "short",
    } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(true);
    expect(result.issues[0]?.level).toBe("warn");
  });
});
