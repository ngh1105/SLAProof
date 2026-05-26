import type { Metadata } from "next";
import Link from "next/link";
import { Activity, FilePlus2 } from "lucide-react";
import "./globals.css";
import { WalletButton } from "./_components/wallet-button";

export const metadata: Metadata = {
  title: "SLAProof",
  description: "GenLayer-backed RPC SLA breach receipts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <Link className="brand" href="/">
              <span className="brand-mark" aria-hidden="true">
                <Activity size={18} />
              </span>
              <span className="brand-title">
                <strong>SLAProof</strong>
                <span>RPC incident receipts</span>
              </span>
            </Link>
            <nav className="topbar-nav" aria-label="Primary navigation">
              <Link className="nav-link" href="/#cases">
                Cases
              </Link>
              <Link className="nav-link" href="/docs">
                Docs
              </Link>
              <Link className="nav-link" href="/audit">
                Audit
              </Link>
              <Link className="button" href="/cases/new">
                <FilePlus2 size={16} />
                New case
              </Link>
              <WalletButton />
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

