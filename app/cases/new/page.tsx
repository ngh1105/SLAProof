import Link from "next/link";
import { ArrowLeft, FileWarning } from "lucide-react";

export default function NewCasePage() {
  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Draft intake</p>
          <h1>New case form is next in the pilot path.</h1>
          <p className="lede">
            The first demo milestone uses seeded cases so the verification loop stays deterministic.
            Pilot hardening will turn this into a full auth-gated intake form.
          </p>
        </div>
        <Link className="ghost-button" href="/">
          <ArrowLeft size={16} />
          Back to queue
        </Link>
      </section>
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Required intake fields</h2>
            <p>Provider, chain, endpoint, UTC window, SLA terms, and typed evidence.</p>
          </div>
          <FileWarning size={22} />
        </div>
        <dl className="definition-list">
          <div>
            <dt>Phase</dt>
            <dd>Milestone 1-2 demo keeps write paths out of scope.</dd>
          </div>
          <div>
            <dt>Next implementation</dt>
            <dd>Persist draft cases locally, validate incident windows, then submit to mock verifier.</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

