"use client";

import { useCallback, useEffect, useState } from "react";
import {
  detectProvider,
  deriveStatus,
  expectedChainId,
  networkLabel,
  type Eip1193Provider,
} from "./genlayer-provider";
import { WalletError, type WalletStatus } from "./types";

type UseGenLayerWalletReturn = {
  status: WalletStatus;
  network: { chainId: number; label: string } | null;
  provider: Eip1193Provider | null;
  error: WalletError | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToExpected: () => Promise<void>;
};

function asAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== "string") return null;
  return /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as `0x${string}`) : null;
}

function parseChainHex(value: unknown): number | null {
  if (typeof value === "string") {
    const n = Number.parseInt(value, 16);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function useGenLayerWallet(): UseGenLayerWalletReturn {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<WalletError | null>(null);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);

  // Provider detection only runs on the client.
  useEffect(() => {
    setProvider(detectProvider());
  }, []);

  // Sync to provider events (account/chain changes).
  useEffect(() => {
    if (!provider) return;
    const onAccounts = (...args: unknown[]) => {
      const arr = Array.isArray(args[0]) ? (args[0] as unknown[]) : [];
      const next = asAddress(arr[0]);
      setAccount(next);
    };
    const onChain = (...args: unknown[]) => {
      setChainId(parseChainHex(args[0]));
    };
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider]);

  const connect = useCallback(async () => {
    if (!provider) {
      setError(new WalletError("WALLET_MISSING", "Install GenLayer wallet to submit."));
      return;
    }
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as unknown[];
      const chainHex = await provider.request({ method: "eth_chainId" });
      const next = asAddress(accounts[0]);
      setAccount(next);
      setChainId(parseChainHex(chainHex));
      setError(null);
    } catch (err) {
      setError(new WalletError("USER_REJECTED", "Wallet connection cancelled.", err));
    }
  }, [provider]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setError(null);
  }, []);

  const switchToExpected = useCallback(async () => {
    if (!provider) {
      setError(new WalletError("WALLET_MISSING", "Install GenLayer wallet first."));
      return;
    }
    const target = expectedChainId();
    if (!target) {
      setError(new WalletError("WRONG_NETWORK", "Expected chain id is not configured."));
      return;
    }
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${target.toString(16)}` }],
      });
      setError(null);
    } catch (err) {
      setError(new WalletError("WRONG_NETWORK", "Failed to switch network.", err));
    }
  }, [provider]);

  const status = deriveStatus(provider, account, chainId);
  const network = chainId != null ? { chainId, label: networkLabel() } : null;

  return { status, network, provider, error, connect, disconnect, switchToExpected };
}
