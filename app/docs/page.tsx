import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const docs = [
  ["Product Spec", "/docs/specs/2026-05-22-slaproof-product-spec.md"],
  ["Product Design", "/docs/design/01-product-design.md"],
  ["System Architecture", "/docs/architecture/01-system-architecture.md"],
  ["Implementation Plan", "/docs/plans/03-implementation-plan.md"],
];

export default function DocsPage() {
  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Project docs</p>
          <h1>Design package lives in the repository.</h1>
          <p className="lede">
            Open the Markdown files from the repo for the full spec, architecture, and build plan.
          </p>
        </div>
      </section>
      <section className="workspace">
        <div className="case-table">
          {docs.map(([label, href]) => (
            <Link className="case-row" href={href} key={href}>
              <strong>{label}</strong>
              <span className="meta-line clip">{href}</span>
              <span />
              <span className="ghost-button">
                Open
                <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

