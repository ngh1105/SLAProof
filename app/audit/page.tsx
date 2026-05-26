import { readAudit } from "@/lib/audit/audit-log";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const entries = readAudit();
  const recent = entries.slice(-50).reverse();

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Pilot operations</p>
          <h1>Case audit log</h1>
          <p className="lede">
            Append-only record of every case state transition. Last 50 entries shown,
            newest first. Stored locally in <code>.data/audit.log.jsonl</code>.
          </p>
        </div>
      </section>

      <section className="panel">
        {recent.length === 0 ? (
          <p>No audit entries yet. Create a case to see activity here.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <th style={{ textAlign: "left", padding: "8px" }}>Timestamp</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Action</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Case</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Actor</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((entry, i) => (
                <tr key={`${entry.timestamp}-${i}`} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td className="mono" style={{ padding: "8px", fontSize: "12px" }}>
                    {entry.timestamp}
                  </td>
                  <td style={{ padding: "8px" }}>
                    <span className={`status ${entry.action === "case_failed" ? "breach" : "no_breach"}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="mono" style={{ padding: "8px" }}>{entry.caseId}</td>
                  <td style={{ padding: "8px" }}>{entry.actor}</td>
                  <td className="mono" style={{ padding: "8px", fontSize: "12px", color: "var(--muted)" }}>
                    {entry.details ? JSON.stringify(entry.details) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
