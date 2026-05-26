export type MonitoringRow = {
  timestamp: string;
  totalRequests: number;
  failedRequests: number;
  errorRate: number;
};

export type CsvParseResult =
  | { ok: true; rows: MonitoringRow[]; summary: string }
  | { ok: false; errors: string[] };

const REQUIRED_HEADERS = ["timestamp", "total_requests", "failed_requests"] as const;

export function parseMonitoringCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  if (lines.length === 0) {
    return { ok: false, errors: ["CSV is empty."] };
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return { ok: false, errors: [`CSV missing required headers: ${missing.join(", ")}`] };
  }

  const idx = {
    ts: header.indexOf("timestamp"),
    total: header.indexOf("total_requests"),
    failed: header.indexOf("failed_requests"),
  };

  const rows: MonitoringRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length && rows.length < 1000; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const total = Number.parseInt(cols[idx.total] ?? "", 10);
    const failed = Number.parseInt(cols[idx.failed] ?? "", 10);
    const ts = cols[idx.ts] ?? "";

    if (!ts || Number.isNaN(total) || Number.isNaN(failed)) {
      errors.push(`Row ${i + 1}: invalid numeric or timestamp value.`);
      continue;
    }
    if (total < 0 || failed < 0 || failed > total) {
      errors.push(`Row ${i + 1}: failed_requests must be 0..total_requests.`);
      continue;
    }
    rows.push({
      timestamp: ts,
      totalRequests: total,
      failedRequests: failed,
      errorRate: total === 0 ? 0 : failed / total,
    });
  }

  if (rows.length === 0) {
    return { ok: false, errors: errors.length ? errors : ["No valid data rows found."] };
  }

  const totalReq = rows.reduce((s, r) => s + r.totalRequests, 0);
  const totalFail = rows.reduce((s, r) => s + r.failedRequests, 0);
  const overallRate = totalReq === 0 ? 0 : (totalFail / totalReq) * 100;
  const summary = [
    `Rows: ${rows.length}`,
    `Total requests: ${totalReq.toLocaleString("en-US")}`,
    `Failed requests: ${totalFail.toLocaleString("en-US")}`,
    `Overall error rate: ${overallRate.toFixed(2)}%`,
    `Window: ${rows[0].timestamp} -> ${rows[rows.length - 1].timestamp}`,
  ].join("\n");

  return { ok: true, rows, summary };
}
