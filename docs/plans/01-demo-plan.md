# Demo Plan

## Demo Goal

Show that SLAProof can turn a messy RPC outage story into a verifiable receipt
using GenLayer. The demo should make the value obvious in five minutes.

## Demo Story

A Web3 app had failed reads from its primary Ethereum RPC provider. The team has
an SLA clause, a status page incident, and a monitoring summary. They want to
know whether the evidence supports a breach and what they can send to the
vendor.

## Demo Dataset

Create three sample cases:

1. Confirmed breach
   - Sustained 5xx failures over threshold.
   - Status page confirms partial outage.
   - Monitoring summary overlaps incident window.

2. No breach
   - Short disruption below SLA threshold.
   - Provider status page says degraded performance lasted only two minutes.
   - Error samples are sparse.

3. Inconclusive
   - User logs suggest elevated latency.
   - No status page incident.
   - Timezone mismatch and missing p95 summary.

## Demo Flow

1. Open dashboard with the three cases.
2. Create or open the confirmed breach case.
3. Review incident window and SLA clause.
4. Inspect evidence items.
5. Run GenLayer verification.
6. Show pending/finalized transaction state.
7. Show receipt with decision, confidence, violated clause, citations, and next
   action.
8. Export receipt JSON and Markdown.

## Demo UI Screens

- Dashboard: case queue and receipt status.
- New case: provider, chain, endpoint, incident window.
- SLA terms: thresholds, exclusions, credit rule.
- Evidence workspace: typed evidence cards.
- Verdict receipt: GenLayer result and export actions.

## What To Emphasize

- GenLayer reads and reasons over public web evidence.
- The verdict is not a generic chatbot answer; it is a stored contract receipt.
- Inconclusive is a valid product outcome.
- The product starts with receipts, not monitoring infrastructure.

## Demo Constraints

- Use mocked or seeded evidence for the first UI demo.
- Use one live GenLayer contract path for the main receipt.
- Do not claim legal enforceability.
- Do not connect to real paid RPC accounts during the first demo.

## Acceptance Criteria

- Full demo can run locally.
- At least one case produces a GenLayer-backed receipt.
- Exports include receipt hash and contract metadata.
- A viewer can understand the breach decision without reading source code.

