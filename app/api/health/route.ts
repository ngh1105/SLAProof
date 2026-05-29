import { NextResponse } from "next/server";
import { getVerifierReadiness } from "@/lib/verifier";
import { pingDatabase } from "@/lib/storage/health-ping";

export const dynamic = "force-dynamic";

export type HealthStatus = {
  status: "ok" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  verifier: {
    mode: string;
    ready: boolean;
    networkLabel?: string;
    issues: string[];
  };
  database: {
    checked: boolean;
    ok: boolean;
  };
  node: string;
};

const startTime = Date.now();

export async function GET() {
  const readiness = getVerifierReadiness();
  const db = await pingDatabase();
  const status: HealthStatus = {
    status: readiness.ready && db.ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version ?? "0.1.0",
    verifier: {
      mode: readiness.mode,
      ready: readiness.ready,
      networkLabel: readiness.networkLabel,
      issues: readiness.issues,
    },
    database: { checked: db.checked, ok: db.ok },
    node: process.version,
  };

  return NextResponse.json(status, {
    status: status.status === "ok" ? 200 : 503,
  });
}
