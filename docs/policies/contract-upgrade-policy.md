# Contract Upgrade & Deployment Policy

Date: 2026-05-26
Status: Pilot scope
Owner: app team

## Scope

Covers `SlaProofRpcVerifier` deployments to GenLayer Studionet. Production
networks (Asimov / Bradbury) require a separate policy review before use.

## Versioning

- App schema versions live in code: `slaproof.case.v0`, `slaproof.receipt.v0`
- `lib/domain/receipt-versions.ts` declares `SUPPORTED_RECEIPT_VERSIONS`
- Bumping a version requires:
  1. Add the new tag to `SUPPORTED_RECEIPT_VERSIONS`
  2. Keep the previous tag for read-back compatibility
  3. Update the contract's `RECEIPT_VERSION` constant
  4. Note the change in `docs/runbooks/genlayer-deployment.md`

## When to redeploy

| Trigger | Action |
|---|---|
| Bug fix in evaluator logic | Redeploy. Old receipts at old address remain readable. |
| New evidence type | Add to `EvidenceType` union + contract validation. Redeploy. |
| Receipt schema change | Bump receipt version. Redeploy. App keeps old version in supported list. |
| Validator prompt change | Redeploy. Old receipts unaffected. |
| Adding read-only method | Redeploy. |

GenLayer contracts are append-only on chain — there is no in-place upgrade.
Each redeploy creates a new address.

## Pre-deploy checklist

```
1. npm run lint
2. npm run typecheck
3. npm test
4. npm run build
5. py -3 -m pytest contracts/slaproof_rpc_verifier
6. py -3 -m py_compile contracts/slaproof_rpc_verifier/main.py contracts/slaproof_rpc_verifier/evaluator.py
7. genvm-lint check contracts/slaproof_rpc_verifier/main.py
8. PR opened, CI green, at least one reviewer approval
```

If step 7 fails with `HTTP Error 404: Not Found` from the SDK loader, AST lint
(`genvm-lint lint`) is the documented fallback (see deployment runbook).

## Deploy procedure

```powershell
genlayer config get
# Confirm: network=studionet, activeAccount has GEN balance for gas
genlayer deploy --contract contracts/slaproof_rpc_verifier/main.py
```

Capture in the deployment runbook:
- Contract address
- Tx hash
- Block / timestamp
- Validator round (5/5 AGREE expected)

## Post-deploy verification

```bash
# 1. Address resolves
genlayer call <NEW_ADDRESS> list_case_ids
# Expect: []

# 2. Read smoke handles missing receipts
NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS=<NEW_ADDRESS> \
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api \
npm run smoke:genlayer:read case-rpc-smoke-test
# Expect: {"case_id": "...", "status": "no_receipt"}

# 3. Update env + runbook + open PR
```

The PR for env update must include:
- Old contract address (kept in changelog for receipt read-back)
- New contract address
- Reason for redeploy
- Verification output from steps 1-2 above

## Rollback

GenLayer deploys cannot be undone, but the app can point back to the previous
address:

```bash
# In .env.local
NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS=<PREVIOUS_ADDRESS>
```

Restart. UI will read old receipts. New writes go to old contract.

If the new contract is broken in a way that produces invalid receipts:
- Flip `NEXT_PUBLIC_SLAPROOF_VERIFIER=mock` to halt new writes
- Investigate via `genlayer trace <txId>`
- Open SEV-2 incident per `docs/runbooks/incident-response.md`

## Address registry

Tracked in `docs/runbooks/genlayer-deployment.md`. Never edit historical rows
— append only. Even broken deploys stay listed for audit.

## Out of scope (production-only)

- On-chain governance or multi-sig deploy approval
- Time-locked upgrades
- Storage migration scripts (each deploy starts empty by design)
- Cross-network address sync (mainnet vs testnet)

## Review cadence

- Every redeploy: re-read this policy + the deployment runbook
- Quarterly: confirm `SUPPORTED_RECEIPT_VERSIONS` drift is intentional
- After any incident touching contract behavior: amend with lessons learned
