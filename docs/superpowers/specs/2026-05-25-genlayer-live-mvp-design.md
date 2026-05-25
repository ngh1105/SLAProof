# GenLayer Live MVP Design

Date: 2026-05-25
Status: Draft for review
Owner: ngh1105
Branch: feature/genlayer-live-mvp-spec

## Summary

Take the existing local-demo SLAProof MVP from "mock receipts only" to "live
GenLayer Studionet receipts" by deploying the `SlaProofRpcVerifier` contract,
wiring the write path through `genlayer-js`, adding a browser wallet flow, and
surfacing the transaction state machine + read-after-write loop in the UI. After
this work, at least one realistic SLA case can be submitted from the browser,
signed by a user wallet, finalized by GenLayer Studionet, and read back as a
receipt with full chain metadata.

This is the "GenLayer Live MVP" defined in the existing roadmap as Phase 2.

## Out of Scope

- Pilot hardening beyond what is already on master (managed Postgres, audit log,
  CSV upload, rate limit). Those remain Phase 3.
- Continuous monitoring, vendor portal, indexer/oracle SLAs.
- Service credit calculator or any payout path.
- Multi-tenant access control beyond the existing single-token pilot gate.
- Auto-polling tx finalization. Manual refresh only for MVP.
- Browser-wallet automation in Playwright. Manual QA covers wallet flows.

## Success Criteria

1. Contract `SlaProofRpcVerifier` is deployed to GenLayer Studionet and the
   address is recorded in `docs/runbooks/genlayer-deployment.md` and
   `.env.local.example`.
2. `npm run smoke:genlayer:read` returns the seeded receipt for a deployed case.
3. `npm run smoke:genlayer:write` (new) submits a case from a CLI demo signer,
   waits for finalization, and reads back the receipt without UI involvement.
4. From the browser, a user can connect a GenLayer wallet, submit one of the
   seeded breach cases, see signing/submitted/pending states, get redirected to
   the receipt page on finalization, and view contract address, network, tx
   hash, and receipt hash on the receipt.
5. Failure modes (wallet missing, wrong network, user rejected, RPC failure,
   execution failed, timeout, missing receipt) each render a distinct,
   actionable UI state.
6. Mock mode still works when `NEXT_PUBLIC_SLAPROOF_VERIFIER` is unset; all
   pre-existing unit tests + Playwright smoke continue to pass (no regressions).
7. New unit tests cover the adapter, the wallet status mapper, and the tx-state
   reducer with fake clients (no live RPC required to run tests).

## Build Order

The work is split into six sub-phases. Each sub-phase ends with a verifiable
artifact so a failure in one does not block the others.

| Sub-phase | Goal | Verifiable artifact |
|---|---|---|
| 2.0 Env + deploy | Repair `genvm-lint` Python env, deploy contract to Studionet, record address | Address committed to runbook + `.env.local.example` |
| 2.1 Contract smoke | Verify read AND write paths from CLI before touching UI | `npm run smoke:genlayer:read` and `npm run smoke:genlayer:write` both pass against live contract |
| 2.2 Adapter ungate | Remove gated stub in `genlayer-adapter.ts`, implement `submit_case` + `waitForTransactionReceipt` + read poll | Unit tests with fake clients pass |
| 2.3 Wallet integration | Add `useGenLayerWallet` hook + topbar wallet button | Manual QA: connect/disconnect/switch network all render correct UI |
| 2.4 Submit UI + tx state | Add Submit button on `/cases/[caseId]` driven by tx-state reducer | Manual QA: submit a seeded case, observe signing → submitted → pending → done |
| 2.5 Receipt read-after-write | Refresh button + contract metadata on `/receipt/[caseId]` | Manual QA: refresh resolves a `MISSING_RECEIPT` once contract finalizes |
| 2.6 E2E + docs | Update Playwright smoke (mock path), screenshots, runbook, demo script | `npm run verify:demo` + `npm run test:e2e` green; runbook reflects deployed address |

## Architecture

```
Browser
  ┌────────────┐  ┌────────────────┐  ┌──────────────────┐
  │ Wallet btn │  │ /cases/[id]    │  │ /receipt/[id]    │
  │ (topbar)   │  │  + Submit      │  │  + Refresh       │
  └─────┬──────┘  └────────┬───────┘  └────────┬─────────┘
        │                  │                   │
        └──────────────────┼───────────────────┘
                           ▼
            lib/wallet/use-genlayer-wallet.ts
                           │
                           ▼
            lib/verifier/genlayer-adapter.ts
              (read + write client wrap)
                           │ genlayer-js
                           ▼
              GenLayer Studionet RPC
                           │
                           ▼
              SlaProofRpcVerifier contract
              submit_case / get_receipt / list_case_ids
```

### Boundaries

- `genlayer-adapter.ts` is the single gateway to chain. UI never imports
  `genlayer-js` directly.
- `useGenLayerWallet` hook isolates wallet provider detection, account state,
  network checks, connect/disconnect. UI only sees the status union.
- `tx-state.ts` is a pure reducer. Page-level React state consumes it. No
  background polling, no persistence — manual refresh on the receipt page is
  the only resume path.
- Mock verifier path (`mock-adapter.ts`) is preserved. `NEXT_PUBLIC_SLAPROOF_VERIFIER`
  toggles between `mock` and `genlayer`. Demo can run offline.

### Files added

```
lib/wallet/use-genlayer-wallet.ts   React hook returning wallet status union
lib/wallet/genlayer-provider.ts     Browser provider detection + chain helpers
lib/wallet/types.ts                 WalletStatus union, WalletError codes
lib/verifier/tx-state.ts            Pure reducer for tx state machine
scripts/smoke-genlayer-write.mjs    CLI write smoke using demo signer
tests/unit/genlayer-adapter.test.ts Adapter happy + failure paths
tests/unit/tx-state.test.ts         Reducer transition coverage
tests/unit/wallet-status.test.ts    Provider+chainId → status mapping
.env.local.example                  Live mode env template
```

### Files modified

```
lib/verifier/genlayer-adapter.ts    Remove gated write stub, wire submit_case
lib/verifier/types.ts               Add VerifierError union, submitCase signature
lib/verifier/index.ts               No behavior change; re-export wallet-driven verifier
app/cases/[caseId]/page.tsx         Submit button + tx-state UI panel
app/receipt/[caseId]/page.tsx       Refresh button + contract metadata block
app/layout.tsx                      Topbar slot for wallet button
docs/runbooks/genlayer-deployment.md  Deployed address + post-deploy verification
README.md                           Live mode section + screenshots
```

## Wallet UX

### Status union

```ts
type WalletStatus =
  | { kind: "missing" }                                  // no provider in window
  | { kind: "disconnected" }                             // provider present, no account
  | { kind: "wrong-network"; account: `0x${string}` }    // wrong chainId
  | { kind: "connected"; account: `0x${string}`; chainId: number };
```

### Hook surface

```ts
useGenLayerWallet(): {
  status: WalletStatus;
  network: { chainId: number; label: string } | null;
  connect(): Promise<void>;
  disconnect(): void;
  error: WalletError | null;
};
```

### UI states (topbar button)

| Status | Visible | Action |
|---|---|---|
| `missing` | "Install wallet" link | external link to wallet install docs |
| `disconnected` | "Connect wallet" button | calls `connect()` |
| `wrong-network` | "Switch to Studionet" button | calls provider switch |
| `connected` | `0x12…ab ▾` | dropdown: copy, disconnect |

## Tx state machine

### States

```
idle ── user clicks Submit ──▶ signing
signing ── wallet rejected ──▶ failed(USER_REJECTED)
signing ── wallet signed ────▶ submitted(txHash)
submitted ── waitForReceipt ─▶ pending
pending ── finalized:success ▶ done(txHash) ──▶ redirect /receipt/[id]
pending ── finalized:failed ─▶ failed(EXECUTION_FAILED)
pending ── timeout (>60s) ───▶ delayed(txHash)
* ── unexpected error ──────▶ failed(RPC_FAILED | UNKNOWN)
```

### Reducer signature

```ts
type TxState =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "submitted"; txHash: `0x${string}` }
  | { kind: "pending"; txHash: `0x${string}` }
  | { kind: "delayed"; txHash: `0x${string}` }
  | { kind: "done"; txHash: `0x${string}` }
  | { kind: "failed"; code: VerifierErrorCode; message: string };

function txReduce(state: TxState, event: TxEvent): TxState;
```

`txReduce` is pure. UI dispatches events from page-level effects.

### Errors

`WalletError` (raised by the hook, never enters the tx reducer):

| Code | Source | UI message |
|---|---|---|
| `WALLET_MISSING` | provider absent | "Install GenLayer wallet to submit." |
| `WRONG_NETWORK` | chainId mismatch | "Switch to Studionet to continue." |

`VerifierErrorCode` (raised by adapter, consumed by tx reducer as `failed`):

| Code | Source | UI message |
|---|---|---|
| `USER_REJECTED` | wallet sign | "Submission cancelled." |
| `RPC_FAILED` | network | "Network error. Try again." |
| `EXECUTION_FAILED` | tx finalized as failure | "Contract rejected the case: <reason>" |
| `TIMEOUT` | poll exhausted | "Finalization is taking longer than expected. Use Refresh receipt." |
| `MISSING_RECEIPT` | tx ok but get_receipt null/malformed | "Receipt not yet available. Refresh." |
| `UNKNOWN` | catch-all | raw error truncated to 200 chars |

The submit page reads `wallet.status` first; if not `connected`, it surfaces the
wallet error directly and never invokes the verifier. This keeps the adapter
free of wallet concerns.

## Submit flow (detailed)

1. User opens `/cases/[caseId]` and clicks **Submit to GenLayer**.
2. Page checks `wallet.status` — if not `connected`, show prompt instead of
   firing the submit (same panel that hosts tx state).
3. Page validates the case once more with `validateCasePayload` (reuses Phase 1
   module). On failure, surface errors inline; do not call adapter.
4. Page dispatches `signing` to the tx reducer; calls
   `verifier.submitCase(slaCase, walletClient)`.
5. Adapter:
   - Serializes via `toContractCaseJson`.
   - Calls `writeContract({ functionName: "submit_case", args: [caseId, json] })`.
   - Returns `{ txHash }` immediately.
6. Page dispatches `submitted(txHash)`, then awaits
   `waitForTransactionReceipt({ hash, retries, interval })` with a 60s budget.
   - Finalized success → `done(txHash)` → `router.push("/receipt/" + caseId)`.
   - Finalized failure → `failed(EXECUTION_FAILED)`.
   - Timeout → `delayed(txHash)` with link to receipt page.
7. Receipt page (`/receipt/[caseId]`) on mount calls `verifier.getReceipt(caseId)`:
   - Returns receipt → render full page with contract metadata.
   - Returns null → show `MISSING_RECEIPT` banner with **Refresh receipt**
     button.
   - Throws → show error banner with retry.

## Testing strategy

### Unit (Vitest, no live RPC required)

- `tests/unit/genlayer-adapter.test.ts`
  - submit happy path returns `{ txHash }`
  - wallet sign rejected → `USER_REJECTED`
  - tx finalized but execution failed → `EXECUTION_FAILED` with reason
  - `get_receipt` returns null → adapter returns `null` (no throw)
  - `get_receipt` returns malformed shape → `MISSING_RECEIPT` thrown
- `tests/unit/tx-state.test.ts`
  - every state transition listed in the state machine
  - error events from any state → `failed`
  - timeout from `pending` → `delayed`
- `tests/unit/wallet-status.test.ts`
  - no provider → `missing`
  - provider, no account → `disconnected`
  - account, wrong chain → `wrong-network`
  - account, correct chain → `connected`

### Smoke (live, opt-in)

- `npm run smoke:genlayer:read <caseId>` — already exists
- `npm run smoke:genlayer:write <caseId>` — new
  - Loads `GENLAYER_PRIVATE_KEY` from env
  - Submits a fixture case
  - Waits for finalization
  - Reads back receipt
  - Exits non-zero on any error

Both smokes are gated on env presence so CI without secrets skips them.

### Manual QA checklist

- [ ] Wallet missing → install link surfaces
- [ ] Wallet disconnected → connect button works
- [ ] Wrong network → switch button switches chain
- [ ] Submit while disconnected → blocked with prompt
- [ ] Sensitive credential in evidence → blocked client-side (Phase 1 regression)
- [ ] Submit valid case → tx hash appears, finalize redirects to receipt
- [ ] Receipt page shows: address, network label, tx hash, receipt hash
- [ ] Refresh receipt resolves a `MISSING_RECEIPT` banner once finalized
- [ ] Mock mode (env var unset) still renders the four seeded verdicts
- []`npm run verify:demo` and `npm run test:e2e` green

### E2E (Playwright)

E2E continues to run against `mock` verifier. Wallet flows are not automated.
A note in `tests/e2e/README.md` documents this constraint.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `genvm-lint` env stays broken → cannot deploy | Medium | Blocks all of 2.1+ | First task of 2.0 is repair. Pin Python 3.12 path in runbook. If still blocked after 1 day, fall back to deploy via raw GenLayer CLI without lint and document the gap. |
| Studionet RPC outage during demo | Low | Blocks demo only | Mock toggle via env var. Demo script tells presenter how to flip. |
| `genlayer-js` API mismatch with assumed signatures | Medium | Forces adapter rewrite | Spike `genlayer-js` API in 2.2 task 1. Fake clients in unit tests insulate the rest of the codebase. |
| Browser wallet provider does not exist as standalone product | Medium | Forces fallback to demo signer | Verify in 2.3 task 1. If no browser wallet, downgrade to demo-signer-only with banner explaining; this matches roadmap's "wallet OR demo signer" wording. |
| Tx finalization >60s during demo | Medium | Awkward UX | `delayed` state has manual refresh. Demo script warns about potential delay. |
| Private key leaks via repo or browser | Low | Critical | Wallet is browser-side; no key in code. Smoke CLI uses env var only. `.gitignore` already covers `.env*`. |
| `submit_case` reverts due to payload schema drift | Medium | Demo blocker | Run smoke write before wiring UI. Validate client-side before write. Schema version field already exists. |
| Receipt schema returned by contract differs from `fromContractReceipt` expectation | Low | Receipt page errors | Adapter validates with `fromContractReceipt`; throws explicit `MISSING_RECEIPT` so UI handles gracefully. |

## Open questions deferred to implementation

- Exact `genlayer-js` write API shape (writeContract argument names, return
  type) — to be confirmed in sub-phase 2.2 spike, before adapter rewrite. Fake
  clients in tests do not depend on this; only the live adapter does.
- Studionet `chainId` value — to be filled into `.env.local.example` and
  `genlayer-provider.ts` after first deploy.
- Whether the contract emits a `submit_failed` revert reason that we can show
  the user, or whether we can only show "execution failed". 2.1 smoke confirms.

## References

- Existing roadmap: `docs/plans/02-production-roadmap.md` (Phase 2)
- Existing implementation plan: `docs/plans/03-implementation-plan.md`
- Deployment runbook: `docs/runbooks/genlayer-deployment.md`
- Phase 1 server validation work: PR #7 (merged into master)
- Adapter today: `lib/verifier/genlayer-adapter.ts`
- Contract today: `contracts/slaproof_rpc_verifier/main.py`
