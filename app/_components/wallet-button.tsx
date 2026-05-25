"use client";

import { useGenLayerWallet } from "@/lib/wallet/use-genlayer-wallet";

export function WalletButton() {
  const { status, connect, disconnect, switchToExpected } = useGenLayerWallet();

  if (status.kind === "missing") {
    return (
      <a
        className="ghost-button"
        href="https://docs.genlayer.com"
        target="_blank"
        rel="noreferrer"
        title="No wallet detected"
      >
        Install wallet
      </a>
    );
  }
  if (status.kind === "disconnected") {
    return (
      <button className="ghost-button" onClick={connect} type="button">
        Connect wallet
      </button>
    );
  }
  if (status.kind === "wrong-network") {
    return (
      <button className="ghost-button" onClick={switchToExpected} type="button">
        Switch network
      </button>
    );
  }
  const short = `${status.account.slice(0, 6)}…${status.account.slice(-4)}`;
  return (
    <button
      className="ghost-button"
      onClick={disconnect}
      type="button"
      title="Click to disconnect"
    >
      {short}
    </button>
  );
}
