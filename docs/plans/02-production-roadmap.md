# Production Roadmap

## Phase 0: Design Package

Goal: complete product, architecture, demo, and readiness docs.

Deliverables:

- Product spec.
- System architecture.
- GenLayer contract spec.
- Demo plan.
- MVP task breakdown.
- Production readiness checklist.

## Phase 1: Local Demo MVP

Goal: build a polished local receipt-first demo.

Deliverables:

- Next.js app shell.
- Seeded SLA cases.
- Local case store.
- Evidence workspace.
- Mock verifier for fast UI iteration.
- Receipt export JSON and Markdown.

Exit criteria:

- Demo flow runs without wallet.
- The three sample cases show breach, no breach, and inconclusive outcomes.
- Build, lint, unit tests, and basic Playwright smoke pass.

## Phase 2: GenLayer Live MVP

Goal: connect the demo to a deployed GenLayer Intelligent Contract.

Deliverables:

- `SlaProofRpcVerifier` contract.
- `genlayer-js` client integration.
- Wallet or demo signer mode.
- Contract smoke tests.
- Live receipt read-after-write flow.
- Contract address and deployment runbook.

Exit criteria:

- At least one realistic case produces a live GenLayer receipt.
- App reads receipt state back from the contract before claiming success.
- Failure states are visible and retryable.

## Phase 3: Pilot Readiness

Goal: make the product credible for a Web3 infra team pilot.

Deliverables:

- Managed persistence.
- Auth-gated workspace.
- Evidence redaction guidance.
- Case audit log.
- Receipt versioning.
- SLA template library for RPC providers.
- CSV upload for monitoring summaries.
- Pilot operator guide.

Exit criteria:

- A team can evaluate real incident evidence without exposing secrets.
- Receipts can be shared outside the workspace.
- Product copy avoids legal overclaiming.

## Phase 4: Production Readiness

Goal: harden reliability, security, observability, and operations.

Deliverables:

- Managed database with backup plan.
- Error tracking and structured logs.
- Rate limits and abuse controls.
- Security review and threat model.
- Contract upgrade/deployment policy.
- Data retention policy.
- Incident response runbook.
- Monitoring for app, contract reads, and GenLayer transaction health.

Exit criteria:

- Production readiness checklist is green or accepted with documented risks.
- Contract behavior is covered by tests.
- App can recover from delayed or failed GenLayer writes.

## Phase 5: Expansion

Possible expansions:

- Continuous endpoint monitoring.
- Indexer SLA receipts.
- Oracle/data feed SLA receipts.
- Vendor transparency pages.
- Service credit calculator.
- Governance forum export.
- Agent API for automated incident workflows.

