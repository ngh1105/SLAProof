import { NextResponse, type NextRequest } from "next/server";
import { readAudit } from "@/lib/audit/audit-log";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  let limit = limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT;
  if (Number.isNaN(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const entries = readAudit(caseId ? { caseId } : undefined);
  const recent = entries.slice(-limit);

  return NextResponse.json({
    count: recent.length,
    total: entries.length,
    entries: recent,
  });
}
