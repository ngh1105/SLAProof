# Contract Review — Prep Checklist

Date: 2026-05-30
Owner: SLAProof maintainers
Purpose: package everything a third-party contract reviewer needs to perform a
focused audit of the `SlaProofRpcVerifier` GenLayer Intelligent Contract. This
document does **not** perform the review; it is the briefing pack handed to the
vendor.

This feeds the "Complete contract audit or focused review" item in the
[Production Readiness Checklist](../readiness/production-readiness-checklist.md)
Production Gate. The application-side security review is packaged separately in
[external-security-review-prep.md](./external-security-review-prep.md).

## Contract surface

All paths are real and verified in this repo.

| File | Role |
|---|---|
| `contracts/slaproof_rpc_verifier/main.py` | The GenLayer Intelligent Contract entrypoint (`SlaProofRpcVerifier`). |
| `contracts/slaproof_rpc_verifier/evaluator.py` | Pure-Python deterministic receipt/validation logic, importable without the GenLayer runtime so tests can pin behavior. Mirrors the contract's deterministic shaping. |
| `contracts/slaproof_rpc_verifier/test_evaluator.py` | Pytest suite over `evaluator.py`. |
| `contracts/slaproof_rpc_verifier/README.md` | Contract method docs + local check commands. |
| `docs/architecture/02-genlayer-contract-spec.md` | Contract specification. |
| `docs/policies/contract-upgrade-policy.md` | Upgrade + deployment governance. |
| `docs/runbooks/genlayer-deployment.md` | Deployment runbook + on-chain address registry. |

### Public methods

From `contracts/slaproof_rpc_verifier/README.md`:

- `submit_case(case_id, case_json)` — validates, evaluates, writes, and returns
  a receipt JSON string.
- `get_receipt(case_id)` — reads the stored receipt JSON for a case id.
- `list_case_ids()` — lists submitted case ids.

The app reaches these through `genlayer-js`; the read-back of `get_receipt` is
required before the app shows a finalized receipt.

## Payload schemas and versions

Versions are pinned as string constants in `evaluator.py` and enforced on
validation:

- **Case payload:** `slaproof.case.v0` (`CASE_VERSION`). Rejected if
  `payload.version` does not match.
- **Receipt:** `slaproof.receipt.v0` (`RECEIPT_VERSION`).
- App-side, `SUPPORTED_RECEIPT_VERSIONS` is validated on read (see threat P9 in
  the production threat model for version-collision handling).

### Case payload shape (`slaproof.case.v0`)

Validated by `validate_case` in `evaluator.py`:

- `version` — must equal `slaproof.case.v0`.
- `case_id`, `provider_name`, `chain`, `endpoint_label` — required non-empty
  strings.
- `incident_summary` — required non-empty.
- `incident_window.start_utc` / `incident_window.end_utc` — required; both must
  end with `Z` (UTC); start must be strictly before end.
- `sla_terms` — at least one measurable threshold required among
  `error_threshold`, `availability_target`, `latency_threshold`.
- `evidence` — list, max `MAX_EVIDENCE_ITEMS` (8). Each item:
  - `id` — required, must be unique within the case (duplicates rejected).
  - `submitted_excerpt` — required, max `MAX_EXCERPT_CHARS` (1200).
  - `source_url` — max `MAX_URL_CHARS` (500).
  - `hash` — optional; if present must equal `fnv1a_text(excerpt)` or it is
    rejected as a hash mismatch.
  - Fewer than 2 evidence items produces a warning (not an error).

### Receipt shape (`slaproof.receipt.v0`)

Built by `build_receipt` in `evaluator.py`:

- `version`, `case_id`, `provider_name`, `chain`, `endpoint_label`.
- `decision` — one of `VERDICTS`: `breach`, `no_breach`, `inconclusive`,
  `needs_more_evidence`.
- `confidence` — integer (verdict-dependent: 88 / 81 / 54 / 25).
- `violated_clauses`, `evidence_citations` (max 3), `validator_reasoning`,
  `recommended_next_action`.
- `created_at`, `transaction_hash`.
- `receipt_hash` — deterministic FNV-1a digest computed over the receipt with
  the hash field blanked, sorted keys, compact separators
  (`receipt_digest`). The reviewer should confirm determinism and that the
  digest covers all material fields.
- On `evaluate_case`, `validation_errors` and `validation_warnings` are
  attached before the hash is finalized.

## State transitions

The contract stores one receipt per case id. Verdict resolution in
`evaluator.py` follows `fallback_decision` → `decision_copy` → `build_receipt`:

1. **Parse.** `parse_case` rejects non-JSON and non-object payloads with a
   `ValueError`.
2. **Validate.** `validate_case` returns `(errors, warnings)`.
3. **Decide.**
   - Any validation `errors` → `needs_more_evidence` (confidence 25).
   - Otherwise a deterministic keyword scan over summary + SLA threshold +
     evidence text picks the verdict:
     - breach signals (`18.6%`, `elevated 5xx`, `sustained 5xx`) → `breach`
       (confidence 88).
     - no-breach signals (`under 3%`, `below the provider`,
       `below threshold`) → `no_breach` (confidence 81).
     - fewer than 2 evidence items → `needs_more_evidence`.
     - else → `inconclusive` (confidence 54).
4. **Build receipt.** `build_receipt` attaches verdict copy, up to 3 evidence
   citations, timestamps, and computes the deterministic `receipt_hash`.
5. **Persist.** The contract stores the receipt JSON keyed by case id;
   `get_receipt` reads it back, `list_case_ids` enumerates keys.

The reviewer should confirm: re-submitting the same `case_id` overwrite vs.
append semantics, idempotency of the digest, and that the keyword-based
`fallback_decision` is intended as the deterministic fallback path alongside
the live LLM evaluation (clarify which runs in production).

## Threat assumptions

App-side threats are covered in
[external-security-review-prep.md](./external-security-review-prep.md). The
contract-specific assumptions, drawn from
[threat-model-production.md](./threat-model-production.md):

- **P6 — Contract upgrade key compromise.** Deployment is governed by a
  multisig with hardware-key signers (planned); the on-chain address registry
  in `genlayer-deployment.md` is append-only and each entry requires a PR
  review with the deploy tx hash. The app pins the contract address per
  environment via env var + `validateEnv`, so a silent address swap requires
  both an env change and a deploy.
- **P9 — Receipt schema collision.** `slaproof.receipt.v0` is the only shipped
  version; `SUPPORTED_RECEIPT_VERSIONS` is enforced app-side. A future `v1`
  must ship a per-version renderer and an explicit version field.
- **Malicious / oversized payloads** (carryover T4). Bounded by
  `MAX_EVIDENCE_ITEMS` (8), `MAX_EXCERPT_CHARS` (1200), `MAX_URL_CHARS` (500),
  and hash-mismatch rejection. LLM prompt-injection guidance applies to the
  evidence text the contract evaluates — the reviewer should probe how the
  contract handles adversarial excerpts and untrusted fetched URL content.
- **Determinism / consensus.** Receipt hashing must be byte-stable across
  validators. The reviewer should confirm `receipt_digest` (sorted keys,
  compact separators, hash field blanked) is deterministic under the GenLayer
  runtime, and that any non-deterministic inputs (URL fetches, LLM calls) are
  handled within GenLayer's equivalence model.
- **Trust boundary.** The app-side store is not the source of truth for a
  verdict; the on-chain receipt is. Read-back is required before display.

## Test-coverage summary

All commands are real (`package.json` + `contracts/.../README.md`).

- **Contract suite:** `npm run test:contract`
  (= `py -3 -m pytest contracts/slaproof_rpc_verifier`). Covers, in
  `contracts/slaproof_rpc_verifier/test_evaluator.py`:
  - invalid JSON rejection (`parse_case`),
  - a complete valid payload (no errors/warnings),
  - missing SLA thresholds,
  - unsupported version + reversed incident window,
  - duplicate evidence ids + hash mismatch,
  - all four verdicts: `breach`, `no_breach`, `inconclusive`,
    `needs_more_evidence`,
  - deterministic `receipt_hash` equals `receipt_digest(receipt)`.
- **Contract lint (static):**
  - `npm run lint:contract` — `genvm-lint check contracts/.../main.py`
  - `npm run lint:contract:ast` — `genvm-lint lint contracts/.../main.py`
  - `py -3 -m py_compile contracts/slaproof_rpc_verifier/main.py`
  - **Known gap:** full `genvm-lint check` fails to load the SDK
    (HTTP 404) on the current machine, so the contract phase is currently
    gated by pytest + py_compile + AST lint only. See the contract README. The
    reviewer should run the full `check` in a clean GenVM environment.
- **App-side coverage** (relevant to the contract integration):
  `npm test` / `npm run test:coverage` (vitest), plus `npm run test:e2e`
  (playwright). Receipt version validation and read-back paths live there.
- **Live on-chain confirmation:** a real write was verified on Studionet —
  tx `0x204a31d397363a2151ecfa3218a501ebcc3cdf7d0ee0e5d343d1b0e9c07b221a`,
  `case-rpc-write-001` receipt readable on-chain (see readiness checklist
  Pilot Gate). CLI smoke: `npm run smoke:genlayer:read` /
  `npm run smoke:genlayer:write`.

## Deployment policy

- **Governance:** `docs/policies/contract-upgrade-policy.md` defines the
  upgrade and rollback process.
- **Runbook + address registry:** `docs/runbooks/genlayer-deployment.md`
  holds the deployment steps and the append-only on-chain address registry.
- **Address pinning:** the deployed contract address is set per environment
  via `NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS` and validated by
  `lib/config/env-validation.ts` (must match `0x[0-9a-fA-F]{40}`). The app
  surfaces the active address + network via `/api/version`.
- **Signing keys:** writes use `GENLAYER_PRIVATE_KEY` (or its aliases) —
  server-side only, never committed, never shared with the reviewer. The
  production deploy target is a multisig (P6), not a single hot wallet.
- **Current network:** Studionet (chain id `61999`,
  `https://studio.genlayer.com/api`).

## Artifacts to hand the vendor

- Source: the four files under `contracts/slaproof_rpc_verifier/`.
- Spec: `docs/architecture/02-genlayer-contract-spec.md`.
- Policies: `docs/policies/contract-upgrade-policy.md`.
- Runbook + address registry: `docs/runbooks/genlayer-deployment.md`.
- Threat model: `docs/security/threat-model-production.md` (P6, P9, T4).
- Test commands: `npm run test:contract`, `npm run lint:contract`,
  `npm run lint:contract:ast`.
- **Env var names only (NO values):** `GENLAYER_PRIVATE_KEY` and aliases are
  signing secrets and must never be shared; public config
  (`NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS`, `NEXT_PUBLIC_GENLAYER_RPC_URL`,
  `NEXT_PUBLIC_SLAPROOF_CHAIN_ID`, `NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL`) may be
  shared — see `docs/runbooks/environment-variables.md`.

Status: prepared, awaiting vendor.
