#!/usr/bin/env node
// One-shot ops report.
//
// Prints a human-readable snapshot of the running app: health, version,
// metrics summary. Useful in incident response to copy/paste into a ticket.
//
// Usage:
//   node scripts/ops-report.mjs                       # localhost:3000
//   node scripts/ops-report.mjs https://app.example   # remote
//   node scripts/ops-report.mjs --json                # raw JSON

const args = process.argv.slice(2);
const json = args.includes("--json");
const target = args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000";

async function fetchJson(path) {
  try {
    const res = await fetch(new URL(path, target));
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
  } catch (err) {
    return { ok: false, status: 0, body: null, error: err instanceof Error ? err.message : String(err) };
  }
}

const [health, version, metrics] = await Promise.all([
  fetchJson("/api/health"),
  fetchJson("/api/version"),
  fetchJson("/api/metrics"),
]);

if (json) {
  console.log(JSON.stringify({ target, health, version, metrics }, null, 2));
  process.exit(health.ok ? 0 : 2);
}

console.log(`SLAProof ops report — ${target}`);
console.log(`Generated at: ${new Date().toISOString()}`);
console.log("");

console.log(`[health] status=${health.body?.status ?? "?"} http=${health.status}`);
if (health.body?.verifier) {
  const v = health.body.verifier;
  console.log(`  verifier: ${v.mode} (${v.networkLabel ?? "?"}) ready=${v.ready}`);
  if (v.issues?.length) console.log(`  issues: ${v.issues.join("; ")}`);
}
if (health.body?.uptime) console.log(`  uptime: ${health.body.uptime}s`);

console.log("");
console.log(`[version] http=${version.status}`);
if (version.body) {
  console.log(`  app: ${version.body.app}`);
  console.log(`  commit: ${version.body.commit}`);
  console.log(`  contract: ${version.body.contract?.address ?? "(unset)"}`);
  console.log(`  receipt: current=${version.body.receipt?.current} supported=${(version.body.receipt?.supported ?? []).join(",")}`);
}

console.log("");
console.log(`[metrics] http=${metrics.status}`);
if (metrics.body) {
  const counters = Object.entries(metrics.body.counters ?? {}).sort();
  if (counters.length === 0) {
    console.log("  no counter activity");
  } else {
    for (const [name, value] of counters) {
      console.log(`  ${name.padEnd(40)} ${value}`);
    }
  }
}

process.exit(health.ok ? 0 : 2);
