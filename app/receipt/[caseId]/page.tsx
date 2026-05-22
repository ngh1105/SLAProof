import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Download, FileJson2 } from "lucide-react";
import { getDemoCase } from "@/lib/domain/fixtures";
import { verifyCaseLocally } from "@/lib/verifier/mock-verifier";
import { exportReceiptJson, exportReceiptMarkdown } from "@/lib/export/receipt-export";

type ReceiptPageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { caseId } = await params;
  const slaCase = getDemoCase(caseId);

  if (!slaCase) notFound();

  const receipt = verifyCaseLocally(slaCase);
  const markdown = exportReceiptMarkdown(receipt);
  const json = exportReceiptJson(receipt);

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <Link className="meta-line" href={`/cases/${slaCase.id}`}>
            <ArrowLeft size={14} />
            Case evidence
          </Link>
          <p className="eyebrow">Local receipt</p>
          <h1>{slaCase.providerName} verdict: {receipt.decision.replace("_", " ")}</h1>
          <p className="lede">{receipt.validatorReasoning}</p>
        </div>
      </section>

      <section className="receipt-layout">
        <div className="stack">
          <section className="panel receipt-hero">
            <span className={`status ${receipt.decision}`}>
              <ClipboardCheck size={14} />
              {receipt.decision.replace("_", " ")}
            </span>
            <div className="confidence">
              <strong>{receipt.confidence}</strong>
              <span>% confidence</span>
            </div>
            <dl className="definition-list">
              <div>
                <dt>Recommended next action</dt>
                <dd>{receipt.recommendedNextAction}</dd>
              </div>
              <div>
                <dt>Receipt hash</dt>
                <dd className="mono">{receipt.receiptHash}</dd>
              </div>
              <div>
                <dt>Transaction</dt>
                <dd className="mono">{receipt.transactionHash}</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <div className="section-header">
              <div>
                <h2>Evidence citations</h2>
                <p>Findings copied into JSON and Markdown exports.</p>
              </div>
              <FileJson2 size={22} />
            </div>
            <div className="evidence-list">
              {receipt.evidenceCitations.map((citation) => (
                <article className="evidence-item" key={citation.evidenceId}>
                  <span className="evidence-type">{citation.evidenceId}</span>
                  <p>{citation.finding}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="stack">
          <section className="panel">
            <div className="section-header">
              <div>
                <h2>Violated clauses</h2>
                <p>Empty means the verifier found no supported breach.</p>
              </div>
            </div>
            <div className="definition-list">
              {receipt.violatedClauses.length ? (
                receipt.violatedClauses.map((clause) => (
                  <div key={clause}>
                    <dt>Clause</dt>
                    <dd>{clause}</dd>
                  </div>
                ))
              ) : (
                <div>
                  <dt>Clause</dt>
                  <dd>None</dd>
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="section-header">
              <div>
                <h2>Export JSON</h2>
                <p>Machine-readable receipt payload.</p>
              </div>
              <Download size={22} />
            </div>
            <pre className="export-box" data-testid="json-export">{json}</pre>
          </section>

          <section className="panel">
            <div className="section-header">
              <div>
                <h2>Export Markdown</h2>
                <p>Vendor escalation summary.</p>
              </div>
              <Download size={22} />
            </div>
            <pre className="export-box" data-testid="markdown-export">{markdown}</pre>
          </section>
        </aside>
      </section>
    </main>
  );
}

