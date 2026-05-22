# SLAProof Implementation Plan

Date: 2026-05-22

## Goal

Build SLAProof from design package to a credible GenLayer MVP in three slices:

1. Local demo MVP with seeded cases and mock verification.
2. Live GenLayer MVP with a deployed `SlaProofRpcVerifier` contract.
3. Pilot hardening toward production readiness.

The first implementation should prove the full product loop before adding
continuous monitoring or vendor-facing features.

## Build Principles

- Receipt-first: prioritize case intake, evidence organization, verdict, and
  export.
- Live-read truth: the app only shows a finalized GenLayer receipt after reading
  contract state back.
- Mock fast, then replace: build the UI and domain model against a local verifier
  first, then swap in the GenLayer verifier through the same interface.
- Operational tone: this is an incident workflow, not a trading or arbitration
  app.
- No payout path in MVP.

## Recommended Stack

- App: Next.js App Router, React, TypeScript.
- Styling: Tailwind CSS.
- Tests: Vitest for domain logic, Playwright for demo flow.
- GenLayer: Python Intelligent Contract plus `genlayer-js` client adapter.
- MVP persistence: local storage or file-backed demo data.
- Pilot persistence: managed Postgres adapter.

## Target Project Structure

```text
SLAProof/
  app/
    page.tsx
    cases/
      new/page.tsx
      [caseId]/page.tsx
    receipt/
      [caseId]/page.tsx
  components/
    dashboard/
    cases/
    evidence/
    receipt/
    shell/
  contracts/
    slaproof_rpc_verifier.py
    tests/
  lib/
    domain/
    genlayer/
    storage/
    verifier/
  scripts/
    demo-seed.mjs
    smoke-contract.mjs
  tests/
    e2e/
    unit/
  docs/
```

## Workstream 1: Local Demo MVP

### Objectives

- Build the product loop without external dependencies.
- Make the demo understandable in under five minutes.
- Validate the data model before contract work.

### Tasks

1. Scaffold a Next.js app inside the existing `E:\SLAProof` repo.
2. Define TypeScript domain models:
   - `SlaCase`
   - `IncidentWindow`
   - `SlaTerms`
   - `EvidenceItem`
   - `Receipt`
3. Add seeded cases:
   - confirmed breach
   - no breach
   - inconclusive
4. Build pages:
   - dashboard
   - new case
   - case detail/evidence workspace
   - verification review
   - receipt view
5. Implement deterministic mock verifier.
6. Add JSON and Markdown receipt export.
7. Add validation:
   - required fields
   - UTC timestamp normalization
   - unique evidence ids
   - evidence hash creation
8. Add unit tests for domain logic.
9. Add Playwright smoke test for dashboard to receipt flow.

### Definition Of Done

- User can complete the breach demo without wallet or GenLayer.
- Mock verifier returns all four verdict states in predictable cases.
- Exports include receipt hash and evidence citations.
- `lint`, `build`, unit tests, and smoke test pass.

## Workstream 2: GenLayer Contract MVP

### Objectives

- Create a contract that stores compact SLA receipt JSON.
- Use GenLayer for subjective SLA/evidence judgment.
- Keep deterministic validation outside or clearly separate from AI judgment.

### Tasks

1. Create `contracts/slaproof_rpc_verifier.py`.
2. Implement storage:
   - `receipts`
   - `case_ids`
3. Implement methods:
   - `submit_case(case_id, case_json)`
   - `get_receipt(case_id)`
   - `list_case_ids()`
4. Add contract payload schema version.
5. Add GenLayer prompt/rubric:
   - incident window consistency
   - SLA threshold interpretation
   - evidence overlap
   - exclusion checks
   - verdict selection
6. Add compact receipt output.
7. Add Python/direct tests for:
   - valid payload
   - missing SLA terms
   - unreachable evidence URL handling
   - breach
   - no breach
   - inconclusive
   - needs more evidence
8. Run GenVM lint.
9. Deploy to localnet.
10. Deploy to Studionet.
11. Record deployment address and smoke result in docs.

### Definition Of Done

- Contract can evaluate at least one realistic seeded case.
- App can read the receipt from contract state.
- Contract tests cover every verdict type.
- Contract address is documented.

## Workstream 3: App And GenLayer Integration

### Objectives

- Replace mock verifier with a live verifier behind the same interface.
- Make transaction states clear and retryable.
- Avoid claiming success until contract read-back succeeds.

### Tasks

1. Define verifier interface:
   - `verifyCase(case): Promise<ReceiptResult>`
   - `getReceipt(caseId): Promise<Receipt | null>`
2. Implement `mockVerifier`.
3. Implement `genlayerVerifier`.
4. Add environment variables:
   - `NEXT_PUBLIC_GENLAYER_RPC_URL`
   - `NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS`
   - `NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL`
5. Add wallet/demo signer mode.
6. Add transaction state machine:
   - idle
   - signing
   - submitted
   - pending
   - finalized
   - failed
7. Add read-after-write polling.
8. Add retry and manual refresh.
9. Show contract metadata on receipt page.
10. Add smoke script for read path.

### Definition Of Done

- One seeded case produces a live GenLayer receipt.
- Failed writes preserve draft case state.
- Pending reads are visible and do not freeze the UI.
- Receipt page shows contract address, network, transaction hash, and receipt
  hash.

## Workstream 4: Demo Polish

### Objectives

- Make SLAProof strong enough for a GenLayer showcase or portfolio submission.
- Keep the interface credible for ops users.

### Tasks

1. Refine dashboard density and case filters.
2. Add receipt status chips.
3. Add evidence type icons.
4. Add UTC preview and timezone helper.
5. Add privacy reminder before submission.
6. Add sample Markdown vendor escalation summary.
7. Capture screenshots for README.
8. Write demo script.
9. Add manual QA checklist.

### Definition Of Done

- Demo can be run by a reviewer from README.
- Screenshots show dashboard, evidence workspace, and receipt.
- Copy avoids legal-finality and payout claims.

## Workstream 5: Pilot Hardening

### Objectives

- Prepare for a real Web3 team or infra vendor pilot.
- Protect evidence and workspace data.

### Tasks

1. Add auth-gated workspace.
2. Add managed Postgres persistence.
3. Add audit log for case changes.
4. Add CSV upload for monitoring summaries.
5. Add evidence redaction warnings.
6. Add receipt versioning and schema validation.
7. Add rate limiting.
8. Add app health endpoint.
9. Add structured logging.
10. Add error tracking.

### Definition Of Done

- A pilot team can use realistic incident evidence without leaking secrets.
- Case lifecycle is auditable.
- Production readiness checklist has no unknown high-risk gaps.

## Verification Gates

### Local Demo Gate

Run before demo release:

```bash
npm run lint
npm run build
npm test
npm run test:e2e
```

### Contract Gate

Run before contract deployment:

```bash
python -m py_compile contracts/slaproof_rpc_verifier.py
genvm-lint check contracts/slaproof_rpc_verifier.py
npm run smoke:contract
```

### Production Gate

Run before any public pilot:

```bash
npm run lint
npm run build
npm test
npm run test:e2e
npm audit --omit=dev --audit-level=high
npm run readiness:check
```

## Milestone Sequence

### Milestone 1: Demo Skeleton

Deliver:

- App scaffold.
- Dashboard.
- Seeded case data.
- Case detail page.

### Milestone 2: Receipt Loop

Deliver:

- Mock verifier.
- Receipt page.
- Export JSON/Markdown.
- Unit tests.

### Milestone 3: GenLayer Contract

Deliver:

- Contract implementation.
- Contract tests.
- Localnet deploy.
- Studionet deploy.

### Milestone 4: Live GenLayer App

Deliver:

- GenLayer verifier adapter.
- Submit/read flow.
- Transaction states.
- Live smoke script.

### Milestone 5: Showcase Release

Deliver:

- Demo script.
- Screenshots.
- QA checklist.
- README setup path.
- Release note.

### Milestone 6: Pilot Readiness

Deliver:

- Auth.
- Managed persistence.
- Audit log.
- CSV upload.
- Observability.

## Known Risks

- Public status pages may not expose enough detail for reliable breach judgment.
- User-submitted log excerpts can be incomplete or biased.
- GenLayer finalization may be slow during demos.
- SLA clauses vary widely between providers.
- Legal teams may object if copy overstates enforceability.

## Risk Mitigations

- Treat `inconclusive` as first-class.
- Require evidence citations in every receipt.
- Use seeded demo cases for predictable presentations.
- Keep "service credit claim support" language instead of "automatic enforcement".
- Add read-back requirement before final receipt display.

## Out Of Scope Until After MVP

- Continuous endpoint monitoring.
- Automatic service credit recovery.
- Vendor negotiation automation.
- Indexer and oracle providers.
- Private log ingestion pipeline.
- Multi-tenant enterprise roles.

