import { snapshot } from "@/lib/observability/metrics";
import { getVerifierReadiness } from "@/lib/verifier";
import { CURRENT_RECEIPT_VERSION, SUPPORTED_RECEIPT_VERSIONS } from "@/lib/domain/receipt-versions";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const metrics = snapshot();
  const readiness = getVerifierReadiness();
  const counters = Object.entries(metrics.counters).sort(([a], [b]) => a.localeCompare(b));
  const histograms = Object.entries(metrics.histograms).sort(([a], [b]) => a.localeCompare(b));

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Pilot operations</p>
          <h1>Ops dashboard</h1>
          <p className="lede">
            Live snapshot of verifier readiness, app metrics, and supported
            schema versions. Refresh to update.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="section-header"><div><h2>Verifier readiness</h2></div></div>
        <dl>
          <dt>Mode</dt><dd className="mono">{readiness.mode}</dd>
          <dt>Status</dt>
          <dd className="mono">
            <span className={`status ${readiness.ready ? "no_breach" : "breach"}`}>
              {readiness.ready ? "READY" : "DEGRADED"}
            </span>
          </dd>
          <dt>Network</dt><dd className="mono">{readiness.networkLabel ?? "(unset)"}</dd>
          <dt>Contract</dt><dd className="mono">{readiness.contractAddress ?? "(unset)"}</dd>
          <dt>RPC URL</dt><dd className="mono">{readiness.rpcUrl ?? "(unset)"}</dd>
          {readiness.issues.length > 0 ? (
            <>
              <dt>Issues</dt>
              <dd>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {readiness.issues.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="panel">
        <div className="section-header"><div><h2>Counters</h2></div></div>
        {counters.length === 0 ? (
          <p>No counter activity yet. Submit a case or hit /api/health to populate.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <th style={{ textAlign: "left", padding: "8px" }}>Name</th>
                <th style={{ textAlign: "right", padding: "8px" }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {counters.map(([name, value]) => (
                <tr key={name} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td className="mono" style={{ padding: "8px" }}>{name}</td>
                  <td className="mono" style={{ padding: "8px", textAlign: "right" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <div className="section-header"><div><h2>Histograms (ms)</h2></div></div>
        {histograms.length === 0 ? (
          <p>No histogram activity yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <th style={{ textAlign: "left", padding: "8px" }}>Name</th>
                <th style={{ textAlign: "right", padding: "8px" }}>n</th>
                <th style={{ textAlign: "right", padding: "8px" }}>min</th>
                <th style={{ textAlign: "right", padding: "8px" }}>avg</th>
                <th style={{ textAlign: "right", padding: "8px" }}>max</th>
              </tr>
            </thead>
            <tbody>
              {histograms.map(([name, h]) => (
                <tr key={name} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td className="mono" style={{ padding: "8px" }}>{name}</td>
                  <td className="mono" style={{ padding: "8px", textAlign: "right" }}>{h.count}</td>
                  <td className="mono" style={{ padding: "8px", textAlign: "right" }}>{h.min.toFixed(0)}</td>
                  <td className="mono" style={{ padding: "8px", textAlign: "right" }}>{h.avg.toFixed(0)}</td>
                  <td className="mono" style={{ padding: "8px", textAlign: "right" }}>{h.max.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <div className="section-header"><div><h2>Schema</h2></div></div>
        <dl>
          <dt>Current receipt version</dt>
          <dd className="mono">{CURRENT_RECEIPT_VERSION}</dd>
          <dt>Supported receipt versions</dt>
          <dd className="mono">{SUPPORTED_RECEIPT_VERSIONS.join(", ")}</dd>
        </dl>
      </section>
    </main>
  );
}
