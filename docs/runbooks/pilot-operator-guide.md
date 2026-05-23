# Pilot Operator Guide

This guide helps a Web3 team run an SLAProof pilot without exposing private
logs, customer data, or secrets.

## Pilot Goal

Evaluate whether SLAProof receipts are useful for:

- Internal incident postmortems.
- Vendor escalation.
- Service credit claim preparation.
- Governance review of infrastructure providers.

The pilot does not provide legal finality or automatic service credit recovery.

## Pilot Roles

- Incident owner: prepares the case and confirms incident timeline.
- Evidence reviewer: checks that evidence is safe to share.
- SLA reviewer: confirms the relevant SLA clause and exclusions.
- Receipt reviewer: decides whether the receipt is useful for escalation.

## Case Intake Checklist

- Provider name.
- Chain and endpoint label.
- UTC incident start and end.
- Short incident summary.
- SLA availability target or error/latency threshold.
- Exclusion clauses.
- Service credit rule if available.
- At least two evidence items.

## Evidence Checklist

Preferred evidence:

- Public status page incident.
- Vendor postmortem.
- Monitoring summary with UTC timestamps.
- Request totals and error-rate percentage.
- Latency percentile summary.
- Support ticket excerpt with private data removed.

Avoid:

- API keys.
- Customer wallet addresses unless already public and necessary.
- Full raw logs with user identifiers.
- Private vendor dashboard URLs.
- Internal incident chat containing unrelated sensitive context.

## Pilot Flow

1. Create the case from a real or representative incident.
2. Redact evidence before pasting excerpts.
3. Confirm timestamps are UTC.
4. Run local mock verification for shape and copy review.
5. If live GenLayer is enabled, submit the case and wait for read-back.
6. Export JSON and Markdown receipts.
7. Review whether the receipt is clear enough for a postmortem or vendor thread.
8. Record outcome and missing evidence.

## Scoring A Pilot

Use the following rubric after each case:

| Question | Pass Signal |
| --- | --- |
| Did the receipt cite the right evidence? | Citations map to the strongest evidence items. |
| Did it avoid overclaiming? | Weak cases become inconclusive or needs-more-evidence. |
| Was the next action useful? | Operator knows what to send or collect next. |
| Was private data protected? | No secrets or customer data in receipt/export. |
| Was the output portable? | Markdown can be pasted into a postmortem or vendor thread. |

## Pilot Exit Criteria

Run at least three cases:

- One likely breach.
- One no-breach or below-threshold incident.
- One inconclusive evidence bundle.

The pilot is successful if at least two receipts are useful without manual
rewriting and the inconclusive case clearly names missing evidence.

