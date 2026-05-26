# GenLayer Live MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move SLAProof from mock-only receipts to live GenLayer Studionet receipts: deploy `SlaProofRpcVerifier`, wire write path through `genlayer-js`, add browser wallet flow, surface tx state machine + manual-refresh read-after-write loop.

**Architecture:** Single chain gateway in `lib/verifier/genlayer-adapter.ts`. Wallet concerns isolated in `lib/wallet/use-genlayer-wallet.ts` hook returning a status union. Tx state machine is a pure reducer in `lib/verifier/tx-state.ts` consumed by page-level React state. Mock verifier path is preserved via `NEXT_PUBLIC_SLAPROOF_VERIFIER` env toggle.

**Tech Stack:** Next.js App Router, React, TypeScript, `genlayer-js` (1.1.8), Vitest, Playwright, Python (GenLayer contract), GenLayer CLI.

**Spec:** `docs/superpowers/specs/2026-05-25-genlayer-live-mvp-design.md`

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `lib/wallet/types.ts` | `WalletStatus` union, `WalletErrorCode` |
| `lib/wallet/genlayer-provider.ts` | Browser provider detection, chain helpers |
| `lib/wallet/use-genlayer-wallet.ts` | React hook: status, connect, disconnect |
| `lib/verifier/tx-state.ts` | Pure reducer: tx state machine |
| `scripts/smoke-genlayer-write.mjs` | CLI write smoke (demo signer) |
| `tests/unit/genlayer-adapter.test.ts` | Adapter happy + failure paths (fake clients) |
| `tests/unit/tx-state.test.ts` | Reducer transition coverage |
| `tests/unit/wallet-status.test.ts` | Provider+chainId → status mapping |
| `.env.local.example` | Live mode env template |
| `app/_components/wallet-button.tsx` | Topbar wallet button |
| `app/cases/[caseId]/_components/submit-panel.tsx` | Tx state UI panel |

**Modified:**

| File | Change |
|---|---|
| `lib/verifier/genlayer-adapter.ts` | Remove gated stub, wire `submit_case` + waitForTransactionReceipt |
| `lib/verifier/types.ts` | Add `VerifierErrorCode` union, `submitCase` signature |
| `app/cases/[caseId]/page.tsx` | Mount submit panel |
| `app/receipt/[caseId]/page.tsx` | Refresh button + contract metadata block |
| `app/layout.tsx` | Mount wallet button in topbar |
| `docs/runbooks/genlayer-deployment.md` | Deployed address + post-deploy verification |
| `README.md` | Live mode section + screenshots |
| `package.json` | Add `smoke:genlayer:write` npm script |

---

## Sub-phase 2.0 — Env + Deploy

**Verifiable artifact:** Address recorded in runbook and `.env.local.example`. Manual verification via `npm run smoke:genlayer:read <caseId>` returning a seeded receipt.

### Task 1: Repair genvm-lint Python env

**Files:**
- Modify: `docs/runbooks/genlayer-deployment.md` (Current Status section)

- [ ] **Step 1: Confirm Python 3.12 path**

Run: `& 'C:\Users\Admin\AppData\Local\Programs\Python\Python312\Scripts\genvm-lint.exe' --version`
Expected: prints a version string. If 404 SDK error, the SDK shim is the problem.

- [ ] **Step 2: Reinstall genlayer SDK in Python 3.12**

Run:
```powershell
& 'C:\Users\Admin\AppData\Local\Programs\Python\Python312\python.exe' -m pip install --upgrade genlayer-sdk
```
Expected: install completes with no 404.

- [ ] **Step 3: Run full lint check**

Run:
```powershell
$env:PYTHONIOENCODING='utf-8'; $env:PYTHONUTF8='1'
& 'C:\Users\Admin\AppData\Local\Programs\Python\Python312\Scripts\genvm-lint.exe' check contracts\slaproof_rpc_verifier\main.py
```
Expected: exits 0 with no errors.

- [ ] **Step 4: Update runbook "Current Status" section**

Replace the "genvm-lint exists in two local Python installs..." paragraph with the working path and note that full `check` now passes.

- [ ] **Step 5: Commit**

```bash
git add docs/runbooks/genlayer-deployment.md
git commit -m "docs(runbook): genvm-lint env repaired, full check passes"
```

### Task 2: Deploy contract to Studionet

**Files:**
- Modify: `docs/runbooks/genlayer-deployment.md` (post-deploy section)
- Create: `.env.local.example`

- [ ] **Step 1: Pre-deploy quality gate**

Run: `npm run lint && npm run typecheck && npm test && npm run build && py -3 -m pytest contracts/slaproof_rpc_verifier`
Expected: all green.

- [ ] **Step 2: Configure GenLayer CLI for Studionet**

Run: `genlayer config set network studionet`
Expected: confirms network selection.

- [ ] **Step 3: Deploy contract**

Run: `genlayer deploy --contract contracts/slaproof_rpc_verifier/main.py`
Expected: prints `Deployed to: 0x...`

Capture the address. If deploy fails with revert, do NOT proceed. Investigate via `genlayer logs` and re-run.

- [ ] **Step 4: Create `.env.local.example`**

```env
# Set NEXT_PUBLIC_SLAPROOF_VERIFIER=genlayer to switch from mock to live mode.
NEXT_PUBLIC_SLAPROOF_VERIFIER=mock
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL=Studionet
NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS=0xPASTE_DEPLOYED_ADDRESS_HERE
NEXT_PUBLIC_SLAPROOF_CHAIN_ID=PASTE_CHAIN_ID_HERE

# Optional: pilot auth token. When set, all routes require login at /login.
# PILOT_TOKEN=

# Optional: server-side demo signer for smoke:genlayer:write only. Never commit.
# GENLAYER_PRIVATE_KEY=0x...
```

- [ ] **Step 5: Update runbook with the deployed address**

Add a new "Deployed Addresses" section with:
- Network: Studionet
- Contract: `0x...`
- Deployed at: <date>
- Deployed by: <git user>
- Tx hash: `0x...`

- [ ] **Step 6: Commit**

```bash
git add .env.local.example docs/runbooks/genlayer-deployment.md
git commit -m "feat: deploy SlaProofRpcVerifier to Studionet"
```

## Sub-phase 2.1 — Contract Smoke

**Verifiable artifact:** `npm run smoke:genlayer:read <caseId>` and `npm run smoke:genlayer:write` both pass against the live contract.

### Task 3: Add smoke:genlayer:write CLI

**Files:**
- Create: `scripts/smoke-genlayer-write.mjs`
- Modify: `package.json`

- [ ] **Step 1: Read existing read-smoke for reference**

Run: `cat scripts/smoke-genlayer-read.mjs`
Expected: see env reads, client factory pattern, error mapping.

- [ ] **Step 2: Write smoke-genlayer-write.mjs**

Create file with: load env, normalize private key, build write client, call `submit_case` with a fixture case id like `case-rpc-smoke-001` and a minimal valid payload, await `waitForTransactionReceipt`, then call `get_receipt(caseId)` and assert the response has `case_id` and `decision`. Exit non-zero with explicit error code on each failure mode.

```js
#!/usr/bin/env node
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const CONTRACT = process.env.NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS;
const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL;
const PK = process.env.GENLAYER_PRIVATE_KEY;
if (!CONTRACT || !RPC || !PK) {
  console.error("Missing env: NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS, NEXT_PUBLIC_GENLAYER_RPC_URL, GENLAYER_PRIVATE_KEY");
  process.exit(2);
}

const caseId = process.argv[2] ?? "case-rpc-smoke-001";
const payload = {
  schema: "slaproof.case.v0",
  case_id: caseId,
  provider_name: "Smoke RPC",
  chain: "ethereum-mainnet",
  endpoint_label: "smoke",
  incident_window: { start_utc: "2026-05-22T10:00:00Z", end_utc: "2026-05-22T10:30:00Z" },
  incident_summary: "smoke test",
  sla_terms: { availability_target: "99.9% monthly", error_threshold: "5% for 5+ min", latency_threshold: "", exclusions: "", credit_rule: "" },
  evidence: [
    { id: "ev-1", type: "status_page", title: "smoke", source_url: "https://example.com", submitted_excerpt: "smoke evidence", hash: "0".repeat(16) },
  ],
};

const account = createAccount(PK);
const client = createClient({ chain: studionet, account, endpoint: RPC });

console.log("submitting", caseId);
const tx = await client.writeContract({
  address: CONTRACT,
  functionName: "submit_case",
  args: [caseId, JSON.stringify(payload)],
  value: 0n,
});
console.log("txHash", tx);

const receipt = await client.waitForTransactionReceipt({ hash: tx, retries: 30, interval: 4000 });
console.log("status", receipt.statusName, "exec", receipt.txExecutionResultName);
if (receipt.txExecutionResultName !== "Success") {
  console.error("execution failed");
  process.exit(3);
}

const result = await client.readContract({
  address: CONTRACT,
  functionName: "get_receipt",
  args: [caseId],
});
console.log("receipt", JSON.stringify(result, null, 2));
if (!result || typeof result !== "object" || !("case_id" in result)) {
  console.error("missing or malformed receipt");
  process.exit(4);
}
process.exit(0);
```

- [ ] **Step 3: Add npm script**

Edit `package.json` scripts block. Add: `"smoke:genlayer:write": "node scripts/smoke-genlayer-write.mjs"`.

- [ ] **Step 4: Run write smoke against live contract**

Run: `GENLAYER_PRIVATE_KEY=0x... NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS=0x... NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api npm run smoke:genlayer:write`
Expected: prints txHash, status Finalized, exec Success, receipt JSON. Exit 0.

If fails, do NOT proceed. The schema is wrong, contract is reverting, or env var is incorrect.

- [ ] **Step 5: Run read smoke for the case the write smoke just created**

Run: `NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS=0x... NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api npm run smoke:genlayer:read case-rpc-smoke-001`
Expected: prints the receipt JSON. Exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke-genlayer-write.mjs package.json
git commit -m "feat(scripts): add smoke:genlayer:write CLI"
```


## Sub-phase 2.2 — Adapter Ungate

**Verifiable artifact:** `tests/unit/genlayer-adapter.test.ts` covers happy + every failure code with fake clients. Live mode reads contract metadata via factory pattern (no behavior change for mock).

### Task 4: Define VerifierErrorCode + submitCase signature

**Files:**
- Modify: `lib/verifier/types.ts`

- [ ] **Step 1: Read existing types**

Run: `cat lib/verifier/types.ts`
Expected: see `SlaVerifier` interface, current methods.

- [ ] **Step 2: Add error code union and submitCase signature**

Append to `lib/verifier/types.ts`:

```ts
export type VerifierErrorCode =
  | "USER_REJECTED"
  | "RPC_FAILED"
  | "EXECUTION_FAILED"
  | "TIMEOUT"
  | "MISSING_RECEIPT"
  | "UNKNOWN";

export class VerifierError extends Error {
  constructor(public readonly code: VerifierErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "VerifierError";
  }
}

export type SubmitCaseInput = {
  slaCase: import("@/lib/domain/types").SlaCase;
  walletClient: unknown; // wallet hook supplies a typed client; adapter narrows internally
};

export type SubmitCaseResult = { txHash: `0x${string}` };
```

Modify `SlaVerifier` interface to add:

```ts
submitCase?(input: SubmitCaseInput): Promise<SubmitCaseResult>;
waitForFinalization?(txHash: `0x${string}`): Promise<void>;
```

(Optional methods — mock adapter may not implement.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/verifier/types.ts
git commit -m "feat(verifier): add VerifierError + submitCase types"
```

### Task 5: Write failing adapter unit tests

**Files:**
- Create: `tests/unit/genlayer-adapter.test.ts`

- [ ] **Step 1: Write the failing test (happy path)**

```ts
import { describe, expect, it, vi } from "vitest";
import { createGenLayerVerifier } from "@/lib/verifier/genlayer-adapter";
import { VerifierError } from "@/lib/verifier/types";
import { getDemoCase } from "@/lib/storage/case-store";

function fakeWriteClient(opts: {
  txHash?: `0x${string}`;
  execResult?: "Success" | "Reverted";
  receipt?: unknown;
  writeThrows?: Error;
}) {
  return {
    async writeContract() {
      if (opts.writeThrows) throw opts.writeThrows;
      return opts.txHash ?? "0xabc";
    },
    async waitForTransactionReceipt() {
      return { txExecutionResultName: opts.execResult ?? "Success", statusName: "Finalized" };
    },
    async readContract() {
      return opts.receipt ?? null;
    },
  };
}

describe("genlayer-adapter submitCase", () => {
  it("returns txHash when write succeeds", async () => {
    const fake = fakeWriteClient({ txHash: "0xdead" });
    const v = createGenLayerVerifier({
      writeClientFactory: async () => fake,
      readClientFactory: async () => fake,
    });
    const slaCase = getDemoCase("case-rpc-breach-001")!;
    const res = await v.submitCase!({ slaCase, walletClient: fake });
    expect(res.txHash).toBe("0xdead");
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run tests/unit/genlayer-adapter.test.ts`
Expected: FAIL — `submitCase` not implemented or factory not exported with this shape.

- [ ] **Step 3: Commit failing test**

```bash
git add tests/unit/genlayer-adapter.test.ts
git commit -m "test(verifier): failing tests for submitCase happy path"
```

### Task 6: Implement adapter submitCase happy path

**Files:**
- Modify: `lib/verifier/genlayer-adapter.ts`

- [ ] **Step 1: Locate gated stub**

Run: `grep -n "gated\|TODO\|stub" lib/verifier/genlayer-adapter.ts`
Expected: shows the current gated comment.

- [ ] **Step 2: Replace gated path with real implementation**

Implement `submitCase`:

```ts
async function submitCase(input: SubmitCaseInput): Promise<SubmitCaseResult> {
  const client = input.walletClient as GenLayerWriteClient;
  const json = JSON.stringify(toContractCaseJson(input.slaCase));
  try {
    const txHash = (await client.writeContract({
      address: getContractAddress(),
      functionName: "submit_case",
      args: [input.slaCase.id, json],
      value: 0n,
    })) as `0x${string}`;
    return { txHash };
  } catch (err) {
    throw mapWriteError(err);
  }
}
```

Add `mapWriteError` helper that detects user rejection (e.g., `code === 4001` or message includes "rejected") → `USER_REJECTED`, else `RPC_FAILED`.

- [ ] **Step 3: Run adapter test — verify pass**

Run: `npx vitest run tests/unit/genlayer-adapter.test.ts`
Expected: PASS for happy path.

- [ ] **Step 4: Commit**

```bash
git add lib/verifier/genlayer-adapter.ts
git commit -m "feat(verifier): implement submitCase happy path"
```


### Task 7: Adapter failure-path tests

**Files:**
- Modify: `tests/unit/genlayer-adapter.test.ts`

- [ ] **Step 1: Add failure tests**

Append to `tests/unit/genlayer-adapter.test.ts`:

```ts
describe("genlayer-adapter submitCase failures", () => {
  it("maps user rejection to USER_REJECTED", async () => {
    const fake = fakeWriteClient({ writeThrows: Object.assign(new Error("user rejected"), { code: 4001 }) });
    const v = createGenLayerVerifier({
      writeClientFactory: async () => fake,
      readClientFactory: async () => fake,
    });
    const slaCase = getDemoCase("case-rpc-breach-001")!;
    await expect(v.submitCase!({ slaCase, walletClient: fake }))
      .rejects.toMatchObject({ code: "USER_REJECTED" });
  });

  it("maps generic rpc error to RPC_FAILED", async () => {
    const fake = fakeWriteClient({ writeThrows: new Error("ECONNRESET") });
    const v = createGenLayerVerifier({
      writeClientFactory: async () => fake,
      readClientFactory: async () => fake,
    });
    const slaCase = getDemoCase("case-rpc-breach-001")!;
    await expect(v.submitCase!({ slaCase, walletClient: fake }))
      .rejects.toMatchObject({ code: "RPC_FAILED" });
  });
});

describe("genlayer-adapter waitForFinalization", () => {
  it("resolves on Success", async () => {
    const fake = fakeWriteClient({ execResult: "Success" });
    const v = createGenLayerVerifier({
      writeClientFactory: async () => fake,
      readClientFactory: async () => fake,
    });
    await expect(v.waitForFinalization!("0xabc")).resolves.toBeUndefined();
  });

  it("throws EXECUTION_FAILED on Reverted", async () => {
    const fake = fakeWriteClient({ execResult: "Reverted" });
    const v = createGenLayerVerifier({
      writeClientFactory: async () => fake,
      readClientFactory: async () => fake,
    });
    await expect(v.waitForFinalization!("0xabc"))
      .rejects.toMatchObject({ code: "EXECUTION_FAILED" });
  });
});

describe("genlayer-adapter getReceipt", () => {
  it("returns null when contract returns null", async () => {
    const fake = fakeWriteClient({ receipt: null });
    const v = createGenLayerVerifier({
      writeClientFactory: async () => fake,
      readClientFactory: async () => fake,
    });
    await expect(v.getReceipt("missing")).resolves.toBeNull();
  });

  it("throws MISSING_RECEIPT on malformed shape", async () => {
    const fake = fakeWriteClient({ receipt: { unexpected: true } });
    const v = createGenLayerVerifier({
      writeClientFactory: async () => fake,
      readClientFactory: async () => fake,
    });
    await expect(v.getReceipt("case-rpc-breach-001"))
      .rejects.toMatchObject({ code: "MISSING_RECEIPT" });
  });
});
```

- [ ] **Step 2: Run — verify failure tests fail**

Run: `npx vitest run tests/unit/genlayer-adapter.test.ts`
Expected: FAIL — error mapping not implemented for these cases.

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/unit/genlayer-adapter.test.ts
git commit -m "test(verifier): failing tests for adapter error mapping"
```

### Task 8: Implement adapter failure mapping + waitForFinalization

**Files:**
- Modify: `lib/verifier/genlayer-adapter.ts`

- [ ] **Step 1: Add `mapWriteError` and `waitForFinalization`**

```ts
function mapWriteError(err: unknown): VerifierError {
  if (err && typeof err === "object") {
    const code = (err as { code?: unknown }).code;
    const msg = (err as Error).message ?? "";
    if (code === 4001 || /reject/i.test(msg)) {
      return new VerifierError("USER_REJECTED", "Submission cancelled.", err);
    }
  }
  return new VerifierError("RPC_FAILED", "Network or RPC error.", err);
}

async function waitForFinalization(txHash: `0x${string}`): Promise<void> {
  const client = await readClientFactory(getRpcUrl());
  let receipt;
  try {
    receipt = await client.waitForTransactionReceipt({ hash: txHash, retries: 30, interval: 4000 });
  } catch (err) {
    throw new VerifierError("RPC_FAILED", "Waiting for transaction failed.", err);
  }
  if (receipt.txExecutionResultName !== "Success") {
    throw new VerifierError("EXECUTION_FAILED", `Contract execution reverted (${receipt.txExecutionResultName ?? "Unknown"}).`);
  }
}
```

- [ ] **Step 2: Update getReceipt to throw MISSING_RECEIPT on malformed shape**

```ts
async function getReceipt(caseId: string): Promise<Receipt | null> {
  const client = await readClientFactory(getRpcUrl());
  const raw = await client.readContract({ address: getContractAddress(), functionName: "get_receipt", args: [caseId] });
  if (raw == null) return null;
  try {
    return fromContractReceipt(raw as ContractReceipt);
  } catch (err) {
    throw new VerifierError("MISSING_RECEIPT", "Receipt is not yet available or has unexpected shape.", err);
  }
}
```

- [ ] **Step 3: Run all adapter tests — verify pass**

Run: `npx vitest run tests/unit/genlayer-adapter.test.ts`
Expected: all tests PASS.

- [ ] **Step 4: Run full suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/verifier/genlayer-adapter.ts
git commit -m "feat(verifier): adapter error mapping + waitForFinalization"
```


## Sub-phase 2.3 — Wallet Integration

**Verifiable artifact:** Topbar wallet button. Manual QA: missing/disconnected/wrong-network/connected each render correctly.

### Task 9: Spike genlayer-js wallet API

**Files:** none (research only)

- [ ] **Step 1: Read genlayer-js exports**

Run: `node -e "console.log(Object.keys(require('genlayer-js')))"`
Expected: list of exports. Look for client factory + account types + chain helpers.

- [ ] **Step 2: Check chain definitions**

Run: `node -e "console.log(Object.keys(require('genlayer-js/chains')))"`
Expected: includes `studionet` or similar.

- [ ] **Step 3: Locate wallet provider docs**

Run: `cat node_modules/genlayer-js/README.md | head -100`
Expected: identifies how to connect to a window.ethereum-like provider.

- [ ] **Step 4: Capture findings**

If genlayer-js exposes `window.genlayer` style provider → use it. If not, fallback to MetaMask-style injection via `window.ethereum` with custom RPC. Record decision in spec's open-questions section.

If no usable browser-wallet path exists, downgrade scope: skip Tasks 10–13 and use a "Demo signer" panel (env-based) instead. Document in runbook.

### Task 10: WalletStatus types + provider helpers

**Files:**
- Create: `lib/wallet/types.ts`
- Create: `lib/wallet/genlayer-provider.ts`

- [ ] **Step 1: Write types**

Create `lib/wallet/types.ts`:

```ts
export type WalletStatus =
  | { kind: "missing" }
  | { kind: "disconnected" }
  | { kind: "wrong-network"; account: `0x${string}` }
  | { kind: "connected"; account: `0x${string}`; chainId: number };

export type WalletErrorCode = "WALLET_MISSING" | "WRONG_NETWORK" | "USER_REJECTED" | "UNKNOWN";

export class WalletError extends Error {
  constructor(public readonly code: WalletErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "WalletError";
  }
}
```

- [ ] **Step 2: Write provider helpers**

Create `lib/wallet/genlayer-provider.ts`:

```ts
import type { WalletStatus } from "./types";

type Eip1193 = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
};

declare global {
  interface Window {
    genlayer?: Eip1193;
    ethereum?: Eip1193;
  }
}

export function detectProvider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return window.genlayer ?? window.ethereum ?? null;
}

export function expectedChainId(): number {
  const raw = process.env.NEXT_PUBLIC_SLAPROOF_CHAIN_ID;
  return raw ? Number(raw) : 0;
}

export function deriveStatus(provider: Eip1193 | null, account: `0x${string}` | null, chainId: number | null): WalletStatus {
  if (!provider) return { kind: "missing" };
  if (!account) return { kind: "disconnected" };
  if (chainId !== expectedChainId()) return { kind: "wrong-network", account };
  return { kind: "connected", account, chainId };
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/wallet/types.ts lib/wallet/genlayer-provider.ts
git commit -m "feat(wallet): provider detection + status helpers"
```

### Task 11: Failing wallet-status tests

**Files:**
- Create: `tests/unit/wallet-status.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { deriveStatus } from "@/lib/wallet/genlayer-provider";

describe("deriveStatus", () => {
  it("missing when no provider", () => {
    expect(deriveStatus(null, null, null)).toEqual({ kind: "missing" });
  });

  it("disconnected when provider but no account", () => {
    expect(deriveStatus({ request: async () => null }, null, null)).toEqual({ kind: "disconnected" });
  });

  it("wrong-network when chainId mismatches", () => {
    vi.stubEnv("NEXT_PUBLIC_SLAPROOF_CHAIN_ID", "61999");
    const result = deriveStatus({ request: async () => null }, "0xabc", 1);
    expect(result).toEqual({ kind: "wrong-network", account: "0xabc" });
    vi.unstubAllEnvs();
  });

  it("connected when chainId matches", () => {
    vi.stubEnv("NEXT_PUBLIC_SLAPROOF_CHAIN_ID", "61999");
    const result = deriveStatus({ request: async () => null }, "0xabc", 61999);
    expect(result).toEqual({ kind: "connected", account: "0xabc", chainId: 61999 });
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 2: Run — verify it passes immediately**

Because Task 10 already implemented `deriveStatus`, this test verifies behavior rather than driving new code. If it fails, fix the implementation.

Run: `npx vitest run tests/unit/wallet-status.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/wallet-status.test.ts
git commit -m "test(wallet): cover deriveStatus transitions"
```


### Task 12: useGenLayerWallet hook

**Files:**
- Create: `lib/wallet/use-genlayer-wallet.ts`

- [ ] **Step 1: Write hook**

```ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { detectProvider, deriveStatus, expectedChainId } from "./genlayer-provider";
import { WalletError, type WalletStatus } from "./types";

export function useGenLayerWallet() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<WalletError | null>(null);
  const provider = detectProvider();
  const status: WalletStatus = deriveStatus(provider, account, chainId);

  useEffect(() => {
    if (!provider) return;
    const onAccounts = (a: unknown) => {
      const arr = Array.isArray(a) ? (a as string[]) : [];
      setAccount(arr[0] ? (arr[0] as `0x${string}`) : null);
    };
    const onChain = (c: unknown) => setChainId(typeof c === "string" ? Number.parseInt(c, 16) : null);
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider]);

  const connect = useCallback(async () => {
    if (!provider) {
      setError(new WalletError("WALLET_MISSING", "Install GenLayer wallet to submit."));
      return;
    }
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
      setAccount(accounts[0] as `0x${string}`);
      setChainId(Number.parseInt(chainHex, 16));
      setError(null);
    } catch (err) {
      setError(new WalletError("USER_REJECTED", "Connection rejected.", err));
    }
  }, [provider]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setError(null);
  }, []);

  const switchToExpected = useCallback(async () => {
    if (!provider) return;
    const target = expectedChainId();
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${target.toString(16)}` }] });
    } catch (err) {
      setError(new WalletError("WRONG_NETWORK", "Failed to switch network.", err));
    }
  }, [provider]);

  return { status, error, connect, disconnect, switchToExpected, provider };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/wallet/use-genlayer-wallet.ts
git commit -m "feat(wallet): useGenLayerWallet hook"
```

### Task 13: Topbar wallet button

**Files:**
- Create: `app/_components/wallet-button.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write button**

```tsx
"use client";
import { useGenLayerWallet } from "@/lib/wallet/use-genlayer-wallet";

export function WalletButton() {
  const { status, connect, disconnect, switchToExpected } = useGenLayerWallet();

  if (status.kind === "missing") {
    return (
      <a className="ghost-button" href="https://docs.genlayer.com/wallet" target="_blank" rel="noreferrer">
        Install wallet
      </a>
    );
  }
  if (status.kind === "disconnected") {
    return <button className="button" onClick={connect}>Connect wallet</button>;
  }
  if (status.kind === "wrong-network") {
    return <button className="button" onClick={switchToExpected}>Switch to Studionet</button>;
  }
  const short = `${status.account.slice(0, 6)}…${status.account.slice(-4)}`;
  return (
    <button className="ghost-button" onClick={disconnect} title="Click to disconnect">
      {short}
    </button>
  );
}
```

- [ ] **Step 2: Mount in layout**

Edit `app/layout.tsx`. Inside `.topbar-nav` after existing nav links, add `<WalletButton />`. Import at top: `import { WalletButton } from "./_components/wallet-button";`.

- [ ] **Step 3: Run dev server, manual QA**

Run: `npm run dev`
Visit `http://localhost:3000`. With no wallet extension installed: button reads "Install wallet". With wallet on wrong chain: "Switch to Studionet". With correct chain + connected: shows shortened address.

- [ ] **Step 4: Lint + typecheck + tests**

Run: `npm run lint && npm run typecheck && npm test`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add app/_components/wallet-button.tsx app/layout.tsx
git commit -m "feat(ui): topbar wallet button"
```


## Sub-phase 2.4 — Submit UI + Tx State

**Verifiable artifact:** Submit a seeded case from the browser, observe signing → submitted → pending → done states, then redirect to `/receipt/[id]`.

### Task 14: Pure tx-state reducer + tests

**Files:**
- Create: `lib/verifier/tx-state.ts`
- Create: `tests/unit/tx-state.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { txReduce, initialTxState } from "@/lib/verifier/tx-state";

describe("txReduce", () => {
  it("idle -> signing on START", () => {
    expect(txReduce(initialTxState, { type: "START" })).toEqual({ kind: "signing" });
  });

  it("signing -> submitted on SIGNED", () => {
    expect(txReduce({ kind: "signing" }, { type: "SIGNED", txHash: "0xabc" }))
      .toEqual({ kind: "submitted", txHash: "0xabc" });
  });

  it("submitted -> pending on AWAIT", () => {
    expect(txReduce({ kind: "submitted", txHash: "0xabc" }, { type: "AWAIT" }))
      .toEqual({ kind: "pending", txHash: "0xabc" });
  });

  it("pending -> done on FINALIZED success", () => {
    expect(txReduce({ kind: "pending", txHash: "0xabc" }, { type: "FINALIZED" }))
      .toEqual({ kind: "done", txHash: "0xabc" });
  });

  it("pending -> delayed on TIMEOUT", () => {
    expect(txReduce({ kind: "pending", txHash: "0xabc" }, { type: "TIMEOUT" }))
      .toEqual({ kind: "delayed", txHash: "0xabc" });
  });

  it("any state -> failed on ERROR", () => {
    const result = txReduce({ kind: "signing" }, { type: "ERROR", code: "USER_REJECTED", message: "x" });
    expect(result).toMatchObject({ kind: "failed", code: "USER_REJECTED" });
  });

  it("ignores unknown events", () => {
    const state = { kind: "signing" } as const;
    expect(txReduce(state, { type: "FINALIZED" })).toEqual(state);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/unit/tx-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement reducer**

Create `lib/verifier/tx-state.ts`:

```ts
import type { VerifierErrorCode } from "./types";

export type TxState =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "submitted"; txHash: `0x${string}` }
  | { kind: "pending"; txHash: `0x${string}` }
  | { kind: "delayed"; txHash: `0x${string}` }
  | { kind: "done"; txHash: `0x${string}` }
  | { kind: "failed"; code: VerifierErrorCode; message: string };

export type TxEvent =
  | { type: "START" }
  | { type: "SIGNED"; txHash: `0x${string}` }
  | { type: "AWAIT" }
  | { type: "FINALIZED" }
  | { type: "TIMEOUT" }
  | { type: "ERROR"; code: VerifierErrorCode; message: string };

export const initialTxState: TxState = { kind: "idle" };

export function txReduce(state: TxState, event: TxEvent): TxState {
  if (event.type === "ERROR") return { kind: "failed", code: event.code, message: event.message };
  switch (state.kind) {
    case "idle":
      if (event.type === "START") return { kind: "signing" };
      return state;
    case "signing":
      if (event.type === "SIGNED") return { kind: "submitted", txHash: event.txHash };
      return state;
    case "submitted":
      if (event.type === "AWAIT") return { kind: "pending", txHash: state.txHash };
      return state;
    case "pending":
      if (event.type === "FINALIZED") return { kind: "done", txHash: state.txHash };
      if (event.type === "TIMEOUT") return { kind: "delayed", txHash: state.txHash };
      return state;
    default:
      return state;
  }
}
```

- [ ] **Step 4: Run tests — verify all pass**

Run: `npx vitest run tests/unit/tx-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/verifier/tx-state.ts tests/unit/tx-state.test.ts
git commit -m "feat(verifier): pure tx-state reducer + tests"
```


### Task 15: Submit panel component

**Files:**
- Create: `app/cases/[caseId]/_components/submit-panel.tsx`

- [ ] **Step 1: Write component**

```tsx
"use client";
import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { useGenLayerWallet } from "@/lib/wallet/use-genlayer-wallet";
import { initialTxState, txReduce } from "@/lib/verifier/tx-state";
import type { SlaCase } from "@/lib/domain/types";
import { VerifierError } from "@/lib/verifier/types";
import { genlayerVerifierAdapter } from "@/lib/verifier/genlayer-adapter";

export function SubmitPanel({ slaCase }: { slaCase: SlaCase }) {
  const wallet = useGenLayerWallet();
  const [state, dispatch] = useReducer(txReduce, initialTxState);
  const router = useRouter();

  async function onSubmit() {
    if (wallet.status.kind !== "connected") return;
    dispatch({ type: "START" });
    try {
      const { txHash } = await genlayerVerifierAdapter.submitCase!({ slaCase, walletClient: wallet.provider });
      dispatch({ type: "SIGNED", txHash });
      dispatch({ type: "AWAIT" });
      try {
        await genlayerVerifierAdapter.waitForFinalization!(txHash);
        dispatch({ type: "FINALIZED" });
        router.push(`/receipt/${slaCase.id}`);
      } catch (err) {
        if (err instanceof VerifierError && err.code === "TIMEOUT") {
          dispatch({ type: "TIMEOUT" });
        } else if (err instanceof VerifierError) {
          dispatch({ type: "ERROR", code: err.code, message: err.message });
        } else {
          dispatch({ type: "ERROR", code: "UNKNOWN", message: String(err).slice(0, 200) });
        }
      }
    } catch (err) {
      const code = err instanceof VerifierError ? err.code : "UNKNOWN";
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: "ERROR", code, message: message.slice(0, 200) });
    }
  }

  if (wallet.status.kind === "missing") return <div className="panel">Install GenLayer wallet to submit.</div>;
  if (wallet.status.kind === "disconnected") return <button className="button" onClick={wallet.connect}>Connect wallet to submit</button>;
  if (wallet.status.kind === "wrong-network") return <button className="button" onClick={wallet.switchToExpected}>Switch to Studionet</button>;

  return (
    <section className="panel" style={{ display: "grid", gap: 12 }}>
      <h2>Submit to GenLayer</h2>
      {state.kind === "idle" && <button className="button" onClick={onSubmit}>Submit case</button>}
      {state.kind === "signing" && <p>Waiting for wallet signature…</p>}
      {state.kind === "submitted" && <p>Submitted: <code>{state.txHash}</code></p>}
      {state.kind === "pending" && <p>Awaiting finalization for <code>{state.txHash}</code>…</p>}
      {state.kind === "delayed" && (
        <div>
          <p>Finalization is taking longer than expected.</p>
          <a className="ghost-button" href={`/receipt/${slaCase.id}`}>Open receipt page to refresh</a>
        </div>
      )}
      {state.kind === "failed" && (
        <div style={{ color: "var(--danger)" }}>
          <p><strong>{state.code}</strong>: {state.message}</p>
          <button className="ghost-button" onClick={onSubmit}>Retry</button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/cases/[caseId]/_components/submit-panel.tsx
git commit -m "feat(ui): submit panel with tx state machine"
```

### Task 16: Mount submit panel on case page

**Files:**
- Modify: `app/cases/[caseId]/page.tsx`

- [ ] **Step 1: Locate insertion point**

Run: `grep -n "evidence\|incidentSummary\|export default" app/cases/[caseId]/page.tsx | head -20`
Expected: shows page structure.

- [ ] **Step 2: Add submit panel**

Import `SubmitPanel` at top of file. Render `<SubmitPanel slaCase={slaCase} />` near the bottom of the page, below the evidence list and SLA terms summary.

- [ ] **Step 3: Run dev + manual smoke**

Run: `npm run dev`
Open `/cases/case-rpc-breach-001`. Without wallet: see prompt. Connect wallet on Studionet, click Submit. Observe states transition.

If wallet/contract issues prevent live submission, verify the panel renders all four pre-submit prompts (missing/disconnected/wrong-network/connected with submit button).

- [ ] **Step 4: Lint + typecheck + tests**

Run: `npm run lint && npm run typecheck && npm test`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add app/cases/[caseId]/page.tsx
git commit -m "feat(ui): mount submit panel on case page"
```


## Sub-phase 2.5 — Receipt Read-After-Write

**Verifiable artifact:** Receipt page shows contract address, network, tx hash, receipt hash. Refresh button resolves a `MISSING_RECEIPT` once finalized.

### Task 17: Refresh receipt button + contract metadata

**Files:**
- Modify: `app/receipt/[caseId]/page.tsx`

- [ ] **Step 1: Read current page**

Run: `cat app/receipt/[caseId]/page.tsx | head -80`
Expected: see how receipt is fetched and rendered.

- [ ] **Step 2: Convert page to a server component that delegates rendering to a client subcomponent**

If the page is already a client component, skip the conversion. Otherwise, split into:

- `app/receipt/[caseId]/page.tsx` — server component that reads `caseId` from params and renders `<ReceiptView caseId={caseId} />`.
- `app/receipt/[caseId]/_components/receipt-view.tsx` — client component that fetches and displays the receipt with refresh.

- [ ] **Step 3: Implement ReceiptView**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import type { Receipt } from "@/lib/domain/types";
import { genlayerVerifierAdapter } from "@/lib/verifier/genlayer-adapter";
import { VerifierError } from "@/lib/verifier/types";

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; receipt: Receipt };

export function ReceiptView({ caseId }: { caseId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const receipt = await genlayerVerifierAdapter.getReceipt(caseId);
      setState(receipt ? { kind: "ready", receipt } : { kind: "missing" });
    } catch (err) {
      const message = err instanceof VerifierError ? `${err.code}: ${err.message}` : String(err);
      setState({ kind: "error", message });
    }
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  if (state.kind === "loading") return <p>Loading receipt…</p>;
  if (state.kind === "missing") {
    return (
      <section className="panel">
        <h2>Receipt not yet available</h2>
        <p>The transaction may still be finalizing on Studionet.</p>
        <button className="button" onClick={load}>Refresh receipt</button>
      </section>
    );
  }
  if (state.kind === "error") {
    return (
      <section className="panel" style={{ borderColor: "var(--danger)" }}>
        <p style={{ color: "var(--danger)" }}>{state.message}</p>
        <button className="ghost-button" onClick={load}>Try again</button>
      </section>
    );
  }

  const { receipt } = state;
  const address = process.env.NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS ?? "(unset)";
  const network = process.env.NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL ?? "(unset)";
  return (
    <article style={{ display: "grid", gap: 16 }}>
      <header className="panel">
        <h2>{receipt.decision.toUpperCase()}</h2>
        <p>{receipt.validatorReasoning}</p>
      </header>
      <section className="panel">
        <h3>Contract metadata</h3>
        <dl>
          <dt>Contract</dt><dd><code>{address}</code></dd>
          <dt>Network</dt><dd>{network}</dd>
          <dt>Tx hash</dt><dd><code>{receipt.transactionHash ?? "(local)"}</code></dd>
          <dt>Receipt hash</dt><dd><code>{receipt.receiptHash}</code></dd>
        </dl>
        <button className="ghost-button" onClick={load}>Refresh receipt</button>
      </section>
    </article>
  );
}
```

If `Receipt` type does not yet have `transactionHash`, add it as optional in `lib/domain/types.ts` and update `fromContractReceipt` to populate it from the contract response (if available) or leave undefined.

- [ ] **Step 4: Server page**

Replace existing page body with:

```tsx
import { ReceiptView } from "./_components/receipt-view";

export default async function ReceiptPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return (
    <main className="page">
      <ReceiptView caseId={caseId} />
    </main>
  );
}
```

- [ ] **Step 5: Lint + typecheck + tests**

Run: `npm run lint && npm run typecheck && npm test`
Expected: green.

- [ ] **Step 6: Manual QA**

Run: `npm run dev`
Submit a case (Task 16 happy path). After redirect to `/receipt/[caseId]`, the page must show contract address, network, tx hash, receipt hash. If `MISSING_RECEIPT` initially, click Refresh until populated.

- [ ] **Step 7: Commit**

```bash
git add app/receipt/[caseId]/page.tsx app/receipt/[caseId]/_components/receipt-view.tsx lib/domain/types.ts lib/genlayer/contract-payload.ts
git commit -m "feat(ui): receipt page refresh + contract metadata"
```


## Sub-phase 2.6 — E2E + Docs

**Verifiable artifact:** `npm run verify:demo` and `npm run test:e2e` green. Runbook reflects deployed address. README includes screenshots and live-mode quickstart.

### Task 18: Document live-mode in README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add live-mode quickstart**

Append a section after "Local Demo":

```markdown
## Live GenLayer Mode

To run against the deployed `SlaProofRpcVerifier` on Studionet:

1. Copy `.env.local.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SLAPROOF_VERIFIER=genlayer`.
3. Make sure `NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS`, `NEXT_PUBLIC_GENLAYER_RPC_URL`, and `NEXT_PUBLIC_SLAPROOF_CHAIN_ID` are populated.
4. Connect a GenLayer-compatible wallet from the topbar.
5. Open a seeded case and click **Submit case**.

Smoke (no UI):

\`\`\`bash
GENLAYER_PRIVATE_KEY=0x... \
NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS=0x... \
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api \
npm run smoke:genlayer:write
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): live GenLayer mode quickstart"
```

### Task 19: E2E note + run quality gate

**Files:**
- Create: `tests/e2e/README.md`

- [ ] **Step 1: Document e2e mock-only constraint**

```markdown
# E2E

Playwright smoke runs against the **mock verifier** only. Browser wallet flows
(connect, switch chain, sign tx) are not automated. They are covered in the
manual QA checklist in `docs/superpowers/specs/2026-05-25-genlayer-live-mvp-design.md`.

To run e2e:

\`\`\`bash
npm run test:e2e
\`\`\`
```

- [ ] **Step 2: Run full quality gate**

Run: `npm run verify:demo && npm run test:e2e`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/README.md
git commit -m "docs(e2e): document mock-only Playwright scope"
```

### Task 20: Demo script

**Files:**
- Create: `docs/runbooks/live-demo-script.md`

- [ ] **Step 1: Write the demo script**

```markdown
# Live Demo Script

Time: 5 minutes.

## Pre-demo checklist (1 min before recording)

- Verifier env: `NEXT_PUBLIC_SLAPROOF_VERIFIER=genlayer`
- Studionet RPC reachable: `npm run smoke:genlayer:read case-rpc-breach-001`
- Wallet connected on Studionet
- Browser zoom 110%, no extensions visible besides wallet

## Script

1. Open dashboard at `/`. "Three seeded RPC incident cases."
2. Click `case-rpc-breach-001`. "Provider, chain, incident window, SLA terms, evidence."
3. Scroll to evidence. "Each excerpt is hashed client-side before submission."
4. Click **Submit case**. Wallet pops up. Sign.
5. Show submitted state with tx hash.
6. Wait ~30-60s for finalization. If delayed: "Receipt page has a manual refresh."
7. Auto-redirect to receipt page. Show: decision, contract address, network, tx hash, receipt hash.
8. Click Export JSON. "Audit-ready receipt for postmortem or vendor escalation."

## Recovery

- Wallet rejected → "User cancelled, retry."
- RPC failure → switch to mock mode for the rest of the demo: unset `NEXT_PUBLIC_SLAPROOF_VERIFIER`, restart dev.
- Tx finalization > 90s → narrate the `delayed` state and Refresh on receipt page.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/live-demo-script.md
git commit -m "docs(runbook): live demo script"
```

