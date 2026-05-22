# GenLayer Contract Spec

## Contract Name

`SlaProofRpcVerifier`

## Purpose

The contract evaluates RPC provider incident cases against user-provided SLA
terms and evidence bundles. It stores a receipt that can be read by the app and
exported by the user.

## Main Methods

### `submit_case(case_id: str, case_json: str) -> str`

Creates or evaluates an SLA case.

Inputs:

- `case_id`: unique client-generated id.
- `case_json`: serialized case payload.

Behavior:

- Parse and validate the payload.
- Fetch public evidence URLs when possible.
- Ask validators to judge whether the SLA was breached.
- Store a compact receipt.
- Return serialized receipt JSON.

### `get_receipt(case_id: str) -> str`

Returns the stored receipt JSON for a case.

### `list_case_ids() -> list[str]`

Returns case ids known to the contract. For MVP, pagination can be omitted if
the demo data is small. Production should add cursor-based pagination.

## Case Payload

```json
{
  "case_id": "case_rpc_001",
  "provider_name": "Example RPC",
  "chain": "ethereum-mainnet",
  "endpoint_label": "production-read-endpoint",
  "incident_window": {
    "start_utc": "2026-05-22T10:05:00Z",
    "end_utc": "2026-05-22T10:42:00Z"
  },
  "sla_terms": {
    "availability_target": "99.9% monthly",
    "error_threshold": "5% request failures for 5+ minutes",
    "latency_threshold": "p95 under 1000ms",
    "exclusions": "planned maintenance and client-side errors",
    "credit_rule": "10% monthly service credit for confirmed breach"
  },
  "evidence": [
    {
      "id": "ev_status_1",
      "type": "status_page",
      "source_url": "https://status.example.com/incidents/123",
      "submitted_excerpt": "Major outage affecting Ethereum RPC reads.",
      "time_range": "2026-05-22T10:00:00Z/2026-05-22T10:50:00Z",
      "hash": "sha256:..."
    }
  ]
}
```

## Receipt Output

```json
{
  "case_id": "case_rpc_001",
  "decision": "breach",
  "confidence": 88,
  "violated_clauses": [
    "5% request failures for 5+ minutes"
  ],
  "evidence_citations": [
    {
      "evidence_id": "ev_status_1",
      "finding": "Provider acknowledged elevated errors during the incident window."
    }
  ],
  "validator_reasoning": "Evidence from the status page and monitoring summary supports sustained request failures inside the reported window.",
  "recommended_next_action": "Open a vendor service credit claim with receipt JSON and monitoring summary attached.",
  "created_at": "2026-05-22T00:00:00Z",
  "receipt_hash": "sha256:..."
}
```

## Judgment Rubric

Validators should check:

- Whether the incident window is specific and internally consistent.
- Whether the SLA clause defines a measurable breach condition.
- Whether public or user-submitted evidence overlaps the incident window.
- Whether error/latency/outage evidence meets or exceeds the threshold.
- Whether exclusions plausibly apply.
- Whether the claim should be `breach`, `no_breach`, `inconclusive`, or
  `needs_more_evidence`.

## Deterministic Rules

The contract or app should handle these without subjective judgment:

- Timestamp parsing and UTC normalization.
- Required field presence.
- Evidence id uniqueness.
- Receipt hash calculation.
- Case id lookup.

## Subjective GenLayer Judgment

GenLayer should handle:

- Interpreting human-readable SLA clauses.
- Summarizing public incident pages.
- Deciding whether evidence satisfies threshold language.
- Detecting contradictions between vendor and user evidence.
- Producing explainable verdict reasoning.

## Storage Pattern

Use simple string storage for MVP reliability:

- `receipts: TreeMap[str, str]`
- `case_ids: DynArray[str]` or equivalent supported list pattern.

Store compact JSON receipts, not raw full evidence logs.

## Contract Non-Goals

- Payment transfer.
- Legal enforcement.
- Continuous monitoring.
- Long-term storage of private logs.
- Vendor identity verification.

