# MVP Task Breakdown

## Track A: Product Foundation

- Define final product name and tagline.
- Write three seeded incident cases.
- Define receipt copy for breach, no breach, inconclusive, and needs more
  evidence.
- Create SLA template fields for RPC providers.
- Create evidence type taxonomy.

## Track B: Frontend Demo

- Build dashboard with case list and status.
- Build new case form.
- Build SLA terms editor.
- Build evidence workspace.
- Build verdict receipt page.
- Add JSON export.
- Add Markdown export.
- Add empty, loading, pending, failed, and finalized states.
- Add responsive layout checks.

## Track C: Domain Logic

- Define TypeScript models for `SlaCase`, `EvidenceItem`, and `Receipt`.
- Add UTC timestamp normalization.
- Add required-field validation.
- Add evidence hash helper.
- Add receipt hash helper.
- Add deterministic local mock verifier for demo mode.
- Add tests for case validation and verdict mapping.

## Track D: GenLayer Contract

- Create `SlaProofRpcVerifier` contract.
- Add `submit_case`.
- Add `get_receipt`.
- Add `list_case_ids`.
- Implement receipt storage.
- Add prompt/rubric for SLA breach judgment.
- Add direct tests for payload validation and receipt output.
- Run GenVM lint.
- Deploy to localnet.
- Deploy to Studionet.

## Track E: GenLayer App Integration

- Add GenLayer client adapter.
- Add contract address environment variable.
- Add wallet/demo signer mode.
- Submit case payload to contract.
- Poll/read receipt after transaction.
- Show contract address and transaction metadata.
- Add retry flow for failed or delayed finalization.

## Track F: Demo And QA

- Create demo script.
- Create sample receipt exports.
- Add Playwright smoke for dashboard to receipt flow.
- Add build and lint checks.
- Add manual QA checklist.
- Capture screenshots for README.
- Verify live GenLayer case on Studionet.

## Track G: Pilot Hardening

- Add auth boundary.
- Add managed persistence adapter.
- Add case audit log.
- Add evidence redaction warnings.
- Add CSV upload for monitoring summary.
- Add rate limiting for case submission.
- Add receipt version field.
- Add pilot runbook.

## Suggested Build Order

1. Product foundation and seeded cases.
2. Frontend demo with mock verifier.
3. Domain validation and receipt export.
4. GenLayer contract.
5. Live GenLayer integration.
6. Demo polish and QA.
7. Pilot hardening.

