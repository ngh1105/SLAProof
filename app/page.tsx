import Link from "next/link";
import { ArrowUpRight, Clock, FileCheck2, ServerCog } from "lucide-react";
import { demoCases } from "@/lib/domain/fixtures";
import { formatUtcRange } from "@/lib/domain/validation";
import { verifyCaseLocally } from "@/lib/verifier/mock-verifier";
import type { VerdictDecision } from "@/lib/domain/types";

const decisionLabels: Record<VerdictDecision, string> = {
  breach: "Breach",
  no_breach: "No breach",
  inconclusive: "Inconclusive",
  needs_more_evidence: "Needs evidence",
};

export default function Home() {
  const receipts = demoCases.map((slaCase) => verifyCaseLocally(slaCase));
  const breachCount = receipts.filter((receipt) => receipt.decision === "breach").length;
  const readyCount = demoCases.filter((slaCase) => slaCase.status === "ready").length;

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Demo workspace</p>
          <h1>RPC incidents become breach receipts.</h1>
          <p className="lede">
            Review seeded provider outages, inspect SLA clauses and evidence, then run the local
            verifier to generate an exportable receipt.
          </p>
        </div>
        <div className="actions">
          <Link className="button" href={`/cases/${demoCases[0].id}`}>
            Open breach case
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>

      <section className="metrics" aria-label="Workspace metrics">
        <div className="metric">
          <strong>{demoCases.length}</strong>
          <span>Seeded cases</span>
        </div>
        <div className="metric">
          <strong>{readyCount}</strong>
          <span>Ready for review</span>
        </div>
        <div className="metric">
          <strong>{breachCount}</strong>
          <span>Likely breach</span>
        </div>
        <div className="metric">
          <strong>UTC</strong>
          <span>Incident timestamps</span>
        </div>
      </section>

      <section className="workspace" id="cases">
        <div className="workspace-header">
          <div>
            <h2>Case queue</h2>
            <p>Receipt-first demo data for RPC provider SLA review.</p>
          </div>
          <ServerCog size={22} />
        </div>
        <div className="case-table">
          {demoCases.map((slaCase) => {
            const receipt = verifyCaseLocally(slaCase);
            return (
              <Link className="case-row" href={`/cases/${slaCase.id}`} key={slaCase.id}>
                <div className="case-title">
                  <strong>{slaCase.title}</strong>
                  <span className="meta-line">
                    <ServerCog size={14} />
                    {slaCase.providerName} · {slaCase.chain}
                  </span>
                </div>
                <span className={`status ${receipt.decision}`}>
                  <FileCheck2 size={14} />
                  {decisionLabels[receipt.decision]}
                </span>
                <span className="meta-line">
                  <Clock size={14} />
                  {formatUtcRange(slaCase)}
                </span>
                <span className="ghost-button">
                  Open
                  <ArrowUpRight size={15} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

