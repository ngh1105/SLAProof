# SLAProof System Architecture

## Architecture Overview

SLAProof is a web app plus GenLayer Intelligent Contract. The app handles case
intake, evidence normalization, wallet connection, receipt display, and exports.
The Intelligent Contract performs the high-value judgment: reading evidence,
comparing it to SLA terms, and storing the verdict receipt.

```text
User
  |
  v
SLAProof Web App
  |-- Case intake
  |-- Evidence workspace
  |-- GenLayer transaction client
  |-- Receipt viewer/exporter
  |
  v
GenLayer Intelligent Contract
  |-- Evidence summarization
  |-- SLA clause interpretation
  |-- Breach verdict
  |-- Receipt storage
  |
  v
Receipt JSON / Markdown Export
```

## Components

### Web App

Purpose: guide the user from incident evidence to receipt.

Responsibilities:

- Create and edit SLA cases.
- Validate required fields before submission.
- Normalize timestamps to UTC.
- Hash local evidence excerpts before submission.
- Submit the case to GenLayer through `genlayer-js`.
- Read finalized verdicts from the contract.
- Render receipt details and export JSON/Markdown.

### Case Store

MVP mode can use local browser storage or a simple app-side JSON store. Production
should use a managed database. The app store is not the source of truth for a
final verdict; the contract receipt is.

Core entities:

- `SlaCase`
- `SlaClause`
- `EvidenceItem`
- `Receipt`

### GenLayer Contract

Purpose: evaluate an evidence bundle and produce an auditable verdict.

Responsibilities:

- Accept serialized case payloads.
- Fetch public evidence URLs where available.
- Compare evidence against SLA clauses.
- Produce one of the supported verdict types.
- Store a compact receipt per case id.
- Expose read methods for receipts and receipt indexes.

### Export Layer

Purpose: let users carry receipts into existing workflows.

Formats:

- JSON for machines and downstream integrations.
- Markdown for postmortems, governance forums, and vendor emails.

## Data Flow

1. User drafts a case in the app.
2. App validates required case, SLA, and evidence fields.
3. App computes local hashes for pasted evidence excerpts.
4. App serializes the payload and sends a write transaction to GenLayer.
5. Contract fetches public URLs and evaluates the full bundle.
6. Contract stores a receipt and emits the final result.
7. App reads the receipt and displays it.
8. User exports the receipt.

## Evidence Model

Evidence is intentionally typed so the verdict can cite it clearly.

Types:

- `status_page`
- `monitoring_summary`
- `error_sample`
- `vendor_postmortem`
- `support_thread`
- `community_report`
- `other`

Each item includes:

- `id`
- `type`
- `source_url`
- `submitted_excerpt`
- `time_range`
- `hash`
- `notes`

## Error Handling

- Missing SLA terms: block submission and explain required fields.
- Bad incident window: require start before end and normalize to UTC.
- Unreachable evidence URL: keep the submitted excerpt and mark URL fetch as
  failed in the receipt.
- Contradictory evidence: allow `inconclusive`.
- GenLayer transaction failure: preserve draft case and allow retry.
- Delayed finalization: show pending state and keep polling/read action.

## Security And Trust Boundaries

- The app must not silently edit evidence after hashing.
- Private API keys, full logs, and customer data should not be uploaded in MVP.
- Public URLs are fetched by the contract where feasible.
- Pasted evidence is user-provided and should be labeled as such.
- Receipts are evidence aids, not legal judgments.

## Future Extensions

- Continuous endpoint monitors.
- Vendor-facing transparency portal.
- Indexer and oracle SLA templates.
- Service credit calculation.
- Governance proposal integration.
- API for agents and vendor management tools.

