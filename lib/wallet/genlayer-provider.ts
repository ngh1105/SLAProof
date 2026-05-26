import type { WalletStatus } from "./types";

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
};

declare global {
  interface Window {
    genlayer?: Eip1193Provider;
    ethereum?: Eip1193Provider;
  }
}

export function detectProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return window.genlayer ?? window.ethereum ?? null;
}

export function expectedChainId(): number {
  const raw = process.env.NEXT_PUBLIC_SLAPROOF_CHAIN_ID;
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function networkLabel(): string {
  return process.env.NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL ?? "Studionet";
}

export function deriveStatus(
  provider: Eip1193Provider | null,
  account: `0x${string}` | null,
  chainId: number | null,
): WalletStatus {
  if (!provider) return { kind: "missing" };
  if (!account) return { kind: "disconnected" };
  const expected = expectedChainId();
  if (expected !== 0 && chainId !== expected) {
    return { kind: "wrong-network", account };
  }
  if (chainId == null) return { kind: "disconnected" };
  return { kind: "connected", account, chainId };
}
