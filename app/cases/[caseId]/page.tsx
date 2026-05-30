import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, FileText, ShieldCheck } from "lucide-react";
import { getDemoCase } from "@/lib/domain/fixtures";
import { formatUtcRange, validateSlaCase } from "@/lib/domain/validation";
import { verifyCaseLocally } from "@/lib/verifier/mock-verifier";
import { getVerifier, getVerifierMode, getVerifierReadiness } from "@/lib/verifier";
import { SubmitPanel } from "./_components/submit-panel";

type CasePageProps = {
  params: Promise<{ caseId: string }>;
};

export default async function CasePage({ params }: CasePageProps) {
  const { caseId } = await params;
  const slaCase = await getDemoCase(caseId);

  if (!slaCase) notFound();

  const validation = validateSlaCase(slaCase);
  const readiness = getVerifierReadiness();
  const previewReceipt = verifyCaseLocally(slaCase);

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
          <Link className="meta-line" href="/">
            <ArrowLeft size={14} />
            Case queue
          </Link>
          <p className="eyebrow">SLA case</p>
          <h1>{slaCase.title}</h1>
          <p className="lede">{slaCase.incidentSummary}</p>
        </div>
        <div className="actions">
          {getVerifierMode() === "genlayer" ? null : (
            <form action={submitCase}>
              <button className="button" type="submit">
                Submit to verifier
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          <Link className="ghost-button" href={`/receipt/${slaCase.id}`}>
            View receipt
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="detail-grid">
        <div className="stack">
          <section className="panel">
            <div className="section-header">
              <div>
                <h2>Incident frame</h2>
                <p>All timestamps are normalized to UTC before receipt generation.</p>
              </div>
              <Clock size={22} />
            </div>
            <dl className="definition-list">
              <div>
                <dt>Provider</dt>
                <dd>{slaCase.providerName}</dd>
              </div>
              <div>
                <dt>Chain</dt>
                <dd>{slaCase.chain}</dd>
              </div>
              <div>
                <dt>Endpoint label</dt>
                <dd>{slaCase.endpointLabel}</dd>
              </div>
              <div>
                <dt>Incident window</dt>
                <dd>{formatUtcRange(slaCase)}</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <div className="section-header">
              <div>
                <h2>Evidence</h2>
                <p>Each excerpt is hashed locally for a stable receipt trail.</p>
              </div>
              <FileText size={22} />
            </div>
            <div className="evidence-list">
              {slaCase.evidence.map((item) => (
                <article className="evidence-item" key={item.id}>
                  <span className="evidence-type">{item.type.replaceAll("_", " ")}</span>
                  <h3>{item.title}</h3>
                  <p>{item.submittedExcerpt}</p>
                  {item.sourceUrl ? <p className="meta-line clip">{item.sourceUrl}</p> : null}
                  <span className="mono">{item.hash}</span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="stack">
          <section className="panel">
            <div className="section-header">
              <div>
                <h2>SLA terms</h2>
                <p>Thresholds used by the local verifier.</p>
              </div>
              <ShieldCheck size={22} />
            </div>
            <dl className="definition-list">
              <div>
                <dt>Availability</dt>
                <dd>{slaCase.slaTerms.availabilityTarget || "Missing"}</dd>
              </div>
              <div>
                <dt>Error threshold</dt>
                <dd>{slaCase.slaTerms.errorThreshold || "Missing"}</dd>
              </div>
              <div>
                <dt>Latency</dt>
                <dd>{slaCase.slaTerms.latencyThreshold || "Missing"}</dd>
              </div>
              <div>
                <dt>Exclusions</dt>
                <dd>{slaCase.slaTerms.exclusions || "Missing"}</dd>
              </div>
              <div>
                <dt>Credit rule</dt>
                <dd>{slaCase.slaTerms.creditRule || "Missing"}</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <div className="section-header">
              <div>
                <h2>Readiness</h2>
                <p>Local validation before GenLayer submission.</p>
              </div>
              <span className={`status ${previewReceipt.decision}`}>
                {previewReceipt.decision.replace("_", " ")}
              </span>
            </div>
            <dl className="definition-list">
              <div>
                <dt>Verifier</dt>
                <dd>
                  {readiness.mode} · {readiness.ready ? readiness.networkLabel : "setup required"}
                </dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>{validation.valid ? "Ready" : validation.errors.join(" ")}</dd>
              </div>
              <div>
                <dt>Warnings</dt>
                <dd>{validation.warnings.length ? validation.warnings.join(" ") : "None"}</dd>
              </div>
              <div>
                <dt>Expected decision</dt>
                <dd>{previewReceipt.decision.replace("_", " ")}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </section>
      {getVerifierMode() === "genlayer" ? <SubmitPanel slaCase={slaCase} /> : null}
    </main>
  );
}
