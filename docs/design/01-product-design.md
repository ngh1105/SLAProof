# SLAProof Product Design

## Product Shape

SLAProof should feel like an incident review workspace, not a generic Web3 dApp.
The user is likely an ops or infrastructure lead with a concrete problem:
turning evidence into a credible vendor-facing receipt.

The UI should be quiet, dense, and operational. It should prioritize timestamps,
evidence state, contract status, and receipt clarity over decorative crypto
visuals.

## Primary Screens

### 1. Case Dashboard

Purpose: show the current SLA case queue.

Content:

- Case name.
- Provider.
- Chain.
- Incident window.
- Verdict status.
- Confidence.
- Last updated time.

Expected actions:

- Create case.
- Open case.
- Filter by provider, chain, or decision.

### 2. Case Intake

Purpose: capture the minimum viable incident frame.

Fields:

- Provider name.
- Chain.
- Endpoint label.
- Incident start and end.
- Timezone helper with UTC preview.
- Short incident summary.

Validation:

- Start time must be before end time.
- Provider and chain are required.
- Incident summary should be concise and evidence-oriented.

### 3. SLA Terms

Purpose: record what the provider promised.

Fields:

- Availability target.
- Error threshold.
- Latency threshold.
- Exclusions.
- Service credit rule.
- Link to SLA document.

UX rule:

- The app should explain missing or ambiguous terms before allowing final
  submission.

### 4. Evidence Workspace

Purpose: organize proof without pretending all evidence has equal weight.

Evidence cards:

- Type.
- Source URL.
- Submitted excerpt.
- Time range.
- Hash.
- Notes.
- Fetch/read status.

Evidence types:

- Status page.
- Monitoring summary.
- Error sample.
- Vendor postmortem.
- Support thread.
- Community report.
- Other.

### 5. Verification Review

Purpose: show the exact payload before GenLayer submission.

Content:

- Case summary.
- SLA clause summary.
- Evidence count by type.
- Warnings for missing fields.
- Privacy reminder.

Actions:

- Run demo verifier.
- Submit to GenLayer.

### 6. Receipt View

Purpose: make the verdict useful outside the app.

Content:

- Decision.
- Confidence.
- Violated clauses.
- Evidence citations.
- Validator reasoning.
- Recommended next action.
- Contract metadata.
- Receipt hash.

Actions:

- Export JSON.
- Export Markdown.
- Copy vendor escalation summary.

## Key States

- Draft: user is still collecting evidence.
- Ready: required fields are present.
- Submitted: GenLayer transaction is sent.
- Pending: waiting for finalization/read-back.
- Finalized: receipt is readable from contract state.
- Failed: submission or read-back failed and can be retried.

## Demo UX

The demo should include a seeded dashboard with three cases:

- Breach.
- No breach.
- Inconclusive.

The strongest demo path opens the breach case, runs verification, and lands on a
receipt with clear citations. The inconclusive case should be shown briefly to
prove the system does not rubber-stamp claims.

## Design Constraints

- Avoid legal-finality language.
- Avoid casino, court, or generic arbitration metaphors.
- Avoid escrow and payout visuals.
- Do not hide uncertainty.
- Keep export actions visible on the receipt.
- Make UTC timestamps prominent.

## Visual Direction

- Operational SaaS interface.
- Compact tables and forms.
- Clear status chips for decision state.
- Evidence cards with restrained borders.
- Contract metadata in a dedicated technical panel.
- No oversized landing hero for the first screen.

