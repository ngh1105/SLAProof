"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ShieldAlert, FilePlus2, Sparkles } from "lucide-react";
import { hashEvidence } from "@/lib/domain/hash";
import { validateSlaCase } from "@/lib/domain/validation";
import { createCaseAction } from "./actions";
import type { SlaCase, EvidenceItem, EvidenceType } from "@/lib/domain/types";

// Scans text for sensitive patterns (Private keys, credentials, API Keys)
function scanForSensitiveData(text: string): string[] {
  const warnings: string[] = [];
  if (!text) return warnings;

  // 64-char private key pattern
  if (/(?:^|\s|["'])(?:0x)?[0-9a-fA-F]{64}(?:\s|["']|$)/.test(text)) {
    warnings.push("Potential 32-byte Private Key detected! Do NOT submit private keys to the blockchain.");
  }
  // Stripe Secret Key pattern
  if (/sk_(?:live|test)_[0-9a-zA-Z]{24}/.test(text)) {
    warnings.push("Stripe Secret API Key detected! Redact credentials before submission.");
  }
  // Google API Key pattern
  if (/AIzaSy[0-9a-zA-Z-_]{33}/.test(text)) {
    warnings.push("Google API Key detected! Redact credentials before submission.");
  }
  // Authorization Headers
  if (/authorization:\s*(?:bearer|basic)\s+[0-9a-zA-Z+/=_-]+/i.test(text)) {
    warnings.push("Potential Authorization Token detected! Redact headers before submission.");
  }
  return warnings;
}

export default function NewCasePage() {
  // Case Metadata
  const [title, setTitle] = useState("");
  const [providerName, setProviderName] = useState("");
  const [chain, setChain] = useState("ethereum-mainnet");
  const [endpointLabel, setEndpointLabel] = useState("");
  
  // Incident Window
  const [startUtc, setStartUtc] = useState("");
  const [endUtc, setEndUtc] = useState("");
  const [incidentSummary, setIncidentSummary] = useState("");

  // SLA Terms
  const [availabilityTarget, setAvailabilityTarget] = useState("");
  const [errorThreshold, setErrorThreshold] = useState("");
  const [latencyThreshold, setLatencyThreshold] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [creditRule, setCreditRule] = useState("");

  // Dynamic Evidence Items
  const [evidenceList, setEvidenceList] = useState<Omit<EvidenceItem, "hash">[]>([
    {
      id: "ev-1",
      type: "status_page",
      title: "",
      sourceUrl: "",
      submittedExcerpt: "",
    },
  ]);

  // Validation Errors
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add a new evidence item block
  const handleAddEvidence = () => {
    const nextNum = evidenceList.length + 1;
    setEvidenceList([
      ...evidenceList,
      {
        id: `ev-${nextNum}-${Math.random().toString(36).substr(2, 4)}`,
        type: "monitoring_summary",
        title: "",
        sourceUrl: "",
        submittedExcerpt: "",
      },
    ]);
  };

  // Remove an evidence item block
  const handleRemoveEvidence = (index: number) => {
    if (evidenceList.length <= 1) return;
    setEvidenceList(evidenceList.filter((_, i) => i !== index));
  };

  // Update dynamic evidence values
  const handleUpdateEvidence = (
    index: number,
    field: keyof Omit<EvidenceItem, "hash">,
    value: string
  ) => {
    const updated = [...evidenceList];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setEvidenceList(updated);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setWarnings([]);

    // Format Start & End dates to ISO UTC strings ending with Z
    let startIso = startUtc;
    let endIso = endUtc;
    try {
      if (startUtc && !startUtc.endsWith("Z")) {
        startIso = new Date(startUtc).toISOString();
      }
      if (endUtc && !endUtc.endsWith("Z")) {
        endIso = new Date(endUtc).toISOString();
      }
    } catch {
      setErrors(["Invalid date formatting. Please provide valid timestamps."]);
      return;
    }

    // Build the final SlaCase entity
    const computedEvidence: EvidenceItem[] = evidenceList.map((item) => ({
      ...item,
      id: item.id.trim(),
      type: item.type as EvidenceType,
      title: item.title.trim(),
      sourceUrl: item.sourceUrl?.trim(),
      submittedExcerpt: item.submittedExcerpt.trim(),
      hash: hashEvidence(item.submittedExcerpt), // Dynamic client-side hashing!
    }));

    const newCaseId = `case-rpc-${Math.random().toString(36).substring(2, 9)}`;

    const slaCase: SlaCase = {
      id: newCaseId,
      title: title.trim(),
      providerName: providerName.trim(),
      chain: chain,
      endpointLabel: endpointLabel.trim(),
      status: "ready",
      incidentWindow: {
        startUtc: startIso,
        endUtc: endIso,
      },
      incidentSummary: incidentSummary.trim(),
      slaTerms: {
        availabilityTarget: availabilityTarget.trim(),
        errorThreshold: errorThreshold.trim(),
        latencyThreshold: latencyThreshold.trim(),
        exclusions: exclusions.trim(),
        creditRule: creditRule.trim(),
      },
      evidence: computedEvidence,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Scan all evidence excerpts for sensitive credentials
    const allSensitiveErrors: string[] = [];
    for (const item of computedEvidence) {
      const itemErrors = scanForSensitiveData(item.submittedExcerpt);
      if (itemErrors.length > 0) {
        allSensitiveErrors.push(...itemErrors);
      }
    }
    if (allSensitiveErrors.length > 0) {
      setErrors([
        "Intake blocked due to sensitive credentials: " + allSensitiveErrors.join(" | "),
      ]);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Client-side domain validation
    const validation = validateSlaCase(slaCase);
    if (!validation.valid) {
      setErrors(validation.errors);
      setWarnings(validation.warnings);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Call Server Action to save
      await createCaseAction(slaCase);
    } catch {
      setErrors(["Failed to save case. Try again."]);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <Link className="meta-line" href="/">
            <ArrowLeft size={14} />
            Case queue
          </Link>
          <p className="eyebrow">Case intake workspace</p>
          <h1>Create dynamic SLA breach case</h1>
          <p className="lede">
            Draft a new incident case by specifying providers, SLA parameters, and pasting evidence excerpts. Hashes are computed dynamically client-side.
          </p>
        </div>
      </section>

      {errors.length > 0 ? (
        <section className="panel status breach" style={{ display: "grid", gap: "10px", width: "100%" }}>
          <div className="section-header" style={{ border: 0, padding: 0 }}>
            <h2 style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--danger)" }}>
              <ShieldAlert size={20} />
              Validation errors ({errors.length})
            </h2>
          </div>
          <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--danger)", fontSize: "14px", lineHeight: 1.6 }}>
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {warnings.length > 0 ? (
        <section className="panel status inconclusive" style={{ display: "grid", gap: "10px", width: "100%" }}>
          <div className="section-header" style={{ border: 0, padding: 0 }}>
            <h2 style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--warning)" }}>
              <ShieldAlert size={20} />
              Intake warnings ({warnings.length})
            </h2>
          </div>
          <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--warning)", fontSize: "14px", lineHeight: 1.6 }}>
            {warnings.map((warn) => (
              <li key={warn}>{warn}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <form onSubmit={handleSubmit} className="detail-grid">
        <div className="stack">
          {/* Section 1: Incident Frame */}
          <section className="panel">
            <div className="section-header" style={{ marginBottom: "20px" }}>
              <div>
                <h2>1. Incident frame metadata</h2>
                <p>Basic tracking coordinates for this outage.</p>
              </div>
            </div>

            <div className="form-group">
              <label>Case title</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Ethereum mainnet massive reads failure"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Provider name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Northstar RPC"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Chain network</label>
                <select className="select" value={chain} onChange={(e) => setChain(e.target.value)}>
                  <option value="ethereum-mainnet">Ethereum Mainnet</option>
                  <option value="base-mainnet">Base Mainnet</option>
                  <option value="polygon-mainnet">Polygon Mainnet</option>
                  <option value="arbitrum-one">Arbitrum One</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Endpoint label</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. checkout-read-primary"
                value={endpointLabel}
                onChange={(e) => setEndpointLabel(e.target.value)}
                required
              />
            </div>

            <div className="form-row" style={{ marginTop: "10px" }}>
              <div className="form-group">
                <label>Incident window start (UTC)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={startUtc}
                  onChange={(e) => setStartUtc(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Incident window end (UTC)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={endUtc}
                  onChange={(e) => setEndUtc(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: "10px" }}>
              <label>Incident summary</label>
              <textarea
                className="textarea"
                placeholder="Describe what occurred, total failures observed, and timing overlaps..."
                value={incidentSummary}
                onChange={(e) => setIncidentSummary(e.target.value)}
                required
              />
            </div>
          </section>

          {/* Section 2: Evidence Workspace */}
          <section className="panel">
            <div className="section-header" style={{ marginBottom: "20px" }}>
              <div>
                <h2>2. Evidence attachments</h2>
                <p>Paste logs, status pages, postmortems. Hashes are computed dynamically.</p>
              </div>
              <button type="button" className="ghost-button" onClick={handleAddEvidence} style={{ minHeight: "34px", padding: "0 10px" }}>
                <Plus size={16} />
                Add evidence
              </button>
            </div>

            <div className="evidence-list-edit">
              {evidenceList.map((item, index) => {
                const computedHash = item.submittedExcerpt ? hashEvidence(item.submittedExcerpt) : "Pending text input...";
                return (
                  <article className="evidence-card-edit" key={item.id}>
                    {evidenceList.length > 1 ? (
                      <button type="button" className="remove-evidence-btn" onClick={() => handleRemoveEvidence(index)}>
                        <Trash2 size={13} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
                        Remove
                      </button>
                    ) : null}

                    <div className="form-row">
                      <div className="form-group">
                        <label>Evidence ID</label>
                        <input
                          type="text"
                          className="input"
                          value={item.id}
                          onChange={(e) => handleUpdateEvidence(index, "id", e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Evidence type</label>
                        <select
                          className="select"
                          value={item.type}
                          onChange={(e) => handleUpdateEvidence(index, "type", e.target.value)}
                        >
                          <option value="status_page">Status page note</option>
                          <option value="monitoring_summary">Internal probe logs</option>
                          <option value="error_sample">Sample error dumps</option>
                          <option value="vendor_postmortem">Vendor postmortem</option>
                          <option value="support_thread">Support ticket chats</option>
                          <option value="community_report">Community thread reports</option>
                          <option value="other">Other reference</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Attachment title</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. Northstar status page alert"
                        value={item.title}
                        onChange={(e) => handleUpdateEvidence(index, "title", e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Source reference URL (Optional)</label>
                      <input
                        type="url"
                        className="input"
                        placeholder="https://..."
                        value={item.sourceUrl}
                        onChange={(e) => handleUpdateEvidence(index, "sourceUrl", e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Submitted excerpt (Evaluated by LLM/mock verifiers)</label>
                      <textarea
                        className="textarea"
                        placeholder="Paste exactly the raw text block, logs, or status page snippet..."
                        value={item.submittedExcerpt}
                        onChange={(e) => handleUpdateEvidence(index, "submittedExcerpt", e.target.value)}
                        required
                      />
                    </div>

                    {scanForSensitiveData(item.submittedExcerpt).map((warn) => (
                      <div key={warn} style={{ color: "var(--danger)", fontSize: "12px", fontWeight: "bold", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <ShieldAlert size={14} />
                        {warn}
                      </div>
                    ))}

                    <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="mono" style={{ padding: "4px 8px", background: "rgba(0,0,0,0.4)" }}>
                        {computedHash}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Sparkles size={12} className="text-accent" />
                        Dynamic code point hash
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sidebar: SLA Terms */}
        <aside className="stack">
          <section className="panel">
            <div className="section-header" style={{ marginBottom: "20px" }}>
              <div>
                <h2>3. Promised SLA terms</h2>
                <p>Contractual thresholds to verify against.</p>
              </div>
            </div>

            <div className="form-group">
              <label>Availability target (%)</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. 99.9% monthly"
                value={availabilityTarget}
                onChange={(e) => setAvailabilityTarget(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Error threshold</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. 5% failure for 5+ mins"
                value={errorThreshold}
                onChange={(e) => setErrorThreshold(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Latency threshold</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. p95 under 1000ms"
                value={latencyThreshold}
                onChange={(e) => setLatencyThreshold(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Exclusion clauses</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. planned maintenance"
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Service credit rule</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. 10% credit"
                value={creditRule}
                onChange={(e) => setCreditRule(e.target.value)}
              />
            </div>
          </section>

          {/* Action Panel */}
          <section className="panel">
            <div className="section-header" style={{ marginBottom: "15px" }}>
              <h2>Submit Case</h2>
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.5, marginBottom: "20px" }}>
              Before submission, the case is dynamically validated locally. Once submitted, it enters the queue ready for verification.
            </p>
            <button type="submit" className="button" style={{ width: "100%", padding: "12px" }} disabled={isSubmitting}>
              <FilePlus2 size={16} />
              {isSubmitting ? "Creating..." : "Save SLA Case"}
            </button>
          </section>
        </aside>
      </form>
    </main>
  );
}
