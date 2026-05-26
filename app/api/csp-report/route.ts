import { NextResponse, type NextRequest } from "next/server";
import { log } from "@/lib/observability/logger";
import { increment } from "@/lib/observability/metrics";

export const dynamic = "force-dynamic";

// Browsers send CSP violation reports with content-type
// `application/csp-report` (legacy) or `application/reports+json` (Reporting
// API). Accept both, log structured, and return 204.

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    increment("csp_report_invalid_body");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const reports = Array.isArray(body) ? body : [body];
  for (const entry of reports) {
    const csp = (entry as { "csp-report"?: unknown })["csp-report"] ?? entry;
    increment("csp_report_received");
    log.warn("csp_violation", { report: csp });
  }

  return new NextResponse(null, { status: 204 });
}
