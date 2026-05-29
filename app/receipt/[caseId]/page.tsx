import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ClipboardCheck, Download, FileJson2 } from "lucide-react";
import { getDemoCase } from "@/lib/domain/fixtures";
import { exportReceiptJson, exportReceiptMarkdown } from "@/lib/export/receipt-export";
import { toContractCaseJson } from "@/lib/genlayer/contract-payload";
import { verifyCaseLocally } from "@/lib/verifier/mock-verifier";
import { getVerifier, getVerifierReadiness } from "@/lib/verifier";
import { RefreshReceiptButton } from "./_components/refresh-button";

type ReceiptPageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { caseId } = await params;
  const slaCase = await getDemoCase(caseId);

  if (!slaCase) notFound();

  const verifier = getVerifier();
  const readiness = getVerifierReadiness();
  const storedReceipt = await verifier.getReceipt(slaCase.id);
  const hasStoredReceipt = Boolean(storedReceipt);
  const receipt = storedReceipt ?? verifyCaseLocally(slaCase);
  const submittedPayload = toContractCaseJson(slaCase);
  const markdown = hasStoredReceipt
    ? await exportReceiptMarkdown(receipt)
    : "Receipt pending explicit submission and read-back.\n";
  const json = hasStoredReceipt
    ? exportReceiptJson(receipt)
    : '{\n  "status": "pending_receipt_read_back"\n}\n';

  async function submitCase() {
    "use server";

    const submittedCase = await getDemoCase(caseId);
    if (!submittedCase) notFound();

    await getVerifier().verifyCase(submittedCase);
    redirect(`/receipt/${submittedCase.id}`);
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <Link className="meta-line" href={`/cases/${slaCase.id}`}>
            <ArrowLeft size={14} />
            Case evidence
          </Link>
          <p className="eyebrow">{hasStoredReceipt ? "Verifier receipt" : "Receipt pending"}</p>
          <h1>
            {hasStoredReceipt
              ? `${slaCase.providerName} verdict: ${receipt.decision.replace("_", " ")}`
              : `${slaCase.providerName} receipt pending`}
          </h1>
          <p className="lede">
            {hasStoredReceipt
              ? receipt.validatorReasoning
              : "No verifier receipt has been read back yet. The local preview stays visible until explicit submission returns a stored receipt."}
          </p>
        </div>
        {!hasStoredReceipt ? (
          <div className="actions">
            <form action={submitCase}>
              <button className="button" type="submit">
                Submit to verifier
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        ) : null}
      </section>

      <section className="receipt-layout">
        <div className="stack">
          <section className="panel receipt-hero">
            <span className={`status ${hasStoredReceipt ? receipt.decision : "draft"}`}>
              <ClipboardCheck size={14} />
              {hasStoredReceipt ? receipt.decision.replace("_", " ") : "pending"}
            </span>
            <div className="confidence">
              <strong>{receipt.confidence}</strong>
              <span>{hasStoredReceipt ? "% confidence" : "% preview"}</span>
            </div>
            <dl className="definition-list">
              <div>
                <dt>Verifier</dt>
                <dd>
                  {readiness.mode} · {readiness.ready ? readiness.networkLabel : "setup required"}
                </dd>
              </div>
              <div>
                <dt>Recommended next action</dt>
                <dd>
                  {hasStoredReceipt
                    ? receipt.recommendedNextAction
                    : "Submit the case, then wait for finalized receipt read-back."}
                </dd>
              </div>
              <div>
                <dt>Submitted payload</dt>
                <dd className="mono">{submittedPayload.slice(0, 180)}...</dd>
              </div>
              <div>
                <dt>Receipt hash</dt>
                <dd className="mono">{hasStoredReceipt ? receipt.receiptHash : "Pending read-back"}</dd>
              </div>
              <div>
                <dt>Transaction</dt>
                <dd className="mono">
                  {hasStoredReceipt ? receipt.transactionHash : "Pending explicit submission"}
                </dd>
              </div>
              <div>
                <dt>Contract</dt>
                <dd className="mono">{readiness.contractAddress ?? "(unset)"}</dd>
              </div>
            </dl>
            <RefreshReceiptButton />
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
