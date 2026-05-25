"use client";

import { useGenLayerWallet } from "@/lib/wallet/use-genlayer-wallet";

export function WalletButtonInner() {
  const wallet = useGenLayerWallet();

  if (wallet.status.kind === "missing") {
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
  if (wallet.status.kind === "disconnected") {
    return (
      <button className="ghost-button" onClick={wallet.connect} type="button">
        Connect wallet
      </button>
    );
  }
  if (wallet.status.kind === "wrong-network") {
    return (
      <button className="ghost-button" onClick={wallet.switchToExpected} type="button">
        Switch network
      </button>
    );
  }
  const short = `${wallet.status.account.slice(0, 6)}…${wallet.status.account.slice(-4)}`;
  return (
    <button
      className="ghost-button"
      onClick={wallet.disconnect}
      type="button"
      title="Click to disconnect"
    >
      {short}
    </button>
  );
}
