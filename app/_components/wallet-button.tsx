"use client";

import dynamic from "next/dynamic";

const WalletButtonInner = dynamic(
  () => import("./wallet-button-inner").then((m) => m.WalletButtonInner),
  {
    ssr: false,
    loading: () => (
      <span className="ghost-button" aria-hidden="true" style={{ visibility: "hidden" }}>
        Wallet
      </span>
    ),
  },
);

export function WalletButton() {
  return <WalletButtonInner />;
}
