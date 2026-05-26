#!/usr/bin/env node
// External health monitor.
//
// Fetches /api/health from a target URL and exits non-zero when the
// response is missing, malformed, or status != "ok". Designed to be
// invoked by cron / k8s liveness probe / external synthetic monitor.
//
// Usage:
//   node scripts/check-health.mjs                            # localhost:3000
//   node scripts/check-health.mjs https://app.example.com    # remote
//   node scripts/check-health.mjs --json                     # machine-parseable

const args = process.argv.slice(2);
const json = args.includes("--json");
const target = args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000";
const url = new URL("/api/health", target).toString();
const timeoutMs = 5000;

function emit(payload) {
  if (json) {
    console.log(JSON.stringify(payload));
  } else {
    console.log(
      `${payload.ok ? "ok" : "FAIL"}  ${url}  status=${payload.status ?? "n/a"}` +
      (payload.reason ? `  reason=${payload.reason}` : ""),
    );
  }
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

try {
  const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
  clearTimeout(timer);
  const body = await res.json().catch(() => null);
  if (res.status !== 200 || !body || body.status !== "ok") {
    emit({
      ok: false,
      url,
      status: res.status,
      reason: body?.verifier?.issues?.join("; ") ?? "non-200 or malformed body",
    });
    process.exit(2);
  }
  emit({ ok: true, url, status: res.status, uptime: body.uptime });
  process.exit(0);
} catch (err) {
  clearTimeout(timer);
  emit({ ok: false, url, reason: err instanceof Error ? err.message : String(err) });
  process.exit(2);
}
