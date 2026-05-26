import { describe, expect, it, vi } from "vitest";
import { deriveStatus } from "@/lib/wallet/genlayer-provider";

const stubProvider = { request: async () => null };

describe("deriveStatus", () => {
  it("missing when no provider", () => {
    expect(deriveStatus(null, null, null)).toEqual({ kind: "missing" });
  });

  it("disconnected when provider but no account", () => {
    expect(deriveStatus(stubProvider, null, null)).toEqual({ kind: "disconnected" });
  });

  it("wrong-network when chainId mismatches expected", () => {
    vi.stubEnv("NEXT_PUBLIC_SLAPROOF_CHAIN_ID", "61999");
    const result = deriveStatus(
      stubProvider,
      "0xabc" as `0x${string}`,
      1,
    );
    expect(result).toEqual({ kind: "wrong-network", account: "0xabc" });
    vi.unstubAllEnvs();
  });

  it("connected when chainId matches expected", () => {
    vi.stubEnv("NEXT_PUBLIC_SLAPROOF_CHAIN_ID", "61999");
    const result = deriveStatus(
      stubProvider,
      "0xabc" as `0x${string}`,
      61999,
    );
    expect(result).toEqual({ kind: "connected", account: "0xabc", chainId: 61999 });
    vi.unstubAllEnvs();
  });

  it("treats expectedChainId=0 as no constraint and returns connected", () => {
    vi.stubEnv("NEXT_PUBLIC_SLAPROOF_CHAIN_ID", "");
    const result = deriveStatus(
      stubProvider,
      "0xabc" as `0x${string}`,
      1,
    );
    expect(result).toEqual({ kind: "connected", account: "0xabc", chainId: 1 });
    vi.unstubAllEnvs();
  });
});
