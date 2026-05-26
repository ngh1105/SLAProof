import { NextResponse } from "next/server";
import {
  CURRENT_RECEIPT_VERSION,
  SUPPORTED_RECEIPT_VERSIONS,
} from "@/lib/domain/receipt-versions";

export const dynamic = "force-dynamic";

export type VersionInfo = {
  app: string;
  node: string;
  commit: string;
  buildTime: string;
  receipt: {
    current: string;
    supported: readonly string[];
  };
  contract: {
    address: string | null;
    network: string | null;
  };
};

export async function GET() {
  const info: VersionInfo = {
    app: process.env.npm_package_version ?? "0.1.0",
    node: process.version,
    commit: process.env.GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    buildTime: process.env.BUILD_TIME ?? "unknown",
    receipt: {
      current: CURRENT_RECEIPT_VERSION,
      supported: SUPPORTED_RECEIPT_VERSIONS,
    },
    contract: {
      address: process.env.NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS ?? null,
      network: process.env.NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL ?? null,
    },
  };

  return NextResponse.json(info);
}
