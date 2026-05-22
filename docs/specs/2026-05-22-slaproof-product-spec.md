# SLAProof Product Spec

Date: 2026-05-22

## Summary

SLAProof is a GenLayer-backed workspace for verifying whether a Web3 RPC
provider violated a service-level agreement during an incident. The MVP accepts
an incident window, provider details, SLA clauses, and evidence URLs or log
excerpts. A GenLayer Intelligent Contract evaluates the bundle and returns a
portable SLA Breach Receipt.

## Problem

When RPC infrastructure fails, affected teams need credible evidence for
postmortems, vendor escalation, and service credit claims. Today that evidence
is scattered across monitoring logs, public status pages, community reports,
support tickets, and vendor writeups. Vendors may be honest, but they still own
much of the narrative.

Teams need an independent, reproducible way to answer whether the incident
matched the contractually relevant definition of downtime or degraded service.

## Target User

Primary user: DevOps, SRE, protocol ops, or infrastructure lead at a Web3 team
that pays for RPC access.

Secondary users:

- Protocol governance contributors reviewing infrastructure vendor performance.
- Finance or operations owners preparing service credit claims.
- RPC providers that later want to publish transparent incident receipts.

## MVP Use Case

A protocol team experienced elevated RPC errors on Ethereum mainnet from
10:05 to 10:42 UTC. Their SLA promises 99.9% monthly availability and defines an
incident as sustained 5xx errors or request failures above 5% for at least five
minutes. The team uploads the SLA clause, incident window, status page URL,
probe log excerpts, and vendor postmortem. SLAProof asks GenLayer to determine
whether the evidence supports a breach.

## Core Workflow

1. User creates an SLA case.
2. User enters provider, chain, endpoint label, and incident window.
3. User adds SLA terms: uptime promise, latency threshold, error threshold,
   exclusion clauses, and credit rules.
4. User attaches evidence:
   - Status page or incident URL.
   - Monitoring log excerpt or CSV summary.
   - Error samples.
   - Vendor postmortem.
   - Optional community reports.
5. User submits the case to the GenLayer Intelligent Contract.
6. Contract evaluates the evidence against the SLA terms.
7. App displays a receipt with decision, confidence, violated clauses, citations,
   reasoning, and receipt hash.
8. User exports JSON or Markdown for postmortem, governance, or vendor claim.

## Verdict Types

- `breach`: Evidence supports an SLA violation.
- `no_breach`: Evidence does not support a violation.
- `inconclusive`: Evidence is relevant but insufficient or contradictory.
- `needs_more_evidence`: Required evidence is missing.

## Receipt Fields

- `case_id`
- `provider_name`
- `chain`
- `endpoint_label`
- `incident_window`
- `sla_summary`
- `decision`
- `confidence`
- `violated_clauses`
- `evidence_citations`
- `validator_reasoning`
- `recommended_next_action`
- `created_at`
- `contract_address`
- `transaction_hash`
- `receipt_hash`

## Non-Goals For MVP

- Continuous uptime monitoring.
- Custody, escrow, or automatic service credit payout.
- Legal advice.
- Private log ingestion beyond user-pasted excerpts.
- Supporting every infrastructure category. Indexers and oracles come later.
- Fully automated vendor negotiation.

## Success Criteria

Demo success:

- A user can create a realistic RPC incident case in under three minutes.
- A GenLayer-backed verdict receipt is shown and exportable.
- The demo clearly explains why GenLayer is needed for web evidence and
  subjective SLA interpretation.

Pilot success:

- At least three real or realistic RPC incident cases can be evaluated.
- Receipts are useful enough for an internal postmortem or vendor escalation.
- Ambiguous evidence produces `inconclusive` instead of overclaiming.

## Product Principles

- Receipt-first, monitoring-later.
- Explain every verdict with cited evidence.
- Separate deterministic checks from subjective GenLayer judgment.
- Never claim legal finality.
- Make inconclusive outcomes useful by naming missing evidence.

