# Incident Response Runbook

This runbook covers app-level incidents. For contract deployment issues, see
`genlayer-deployment.md`.

## Severity ladder

| Level | Definition | Response window |
|---|---|---|
| **SEV-1** | Demo broken — pilot users cannot create or view receipts. | Immediate |
| **SEV-2** | Degraded — verifier in mock mode despite `genlayer` env, OR Studionet read fails. | Within 1h |
| **SEV-3** | Cosmetic / single-user — UI glitch, lint warning, non-blocking validation. | Next working day |

## On-call decision tree

1. **App returns 503 from `/api/health`?**
   - Check `verifier.issues[]` in the body. Missing `NEXT_PUBLIC_*` env → fix
     env, restart. Studionet RPC down → flip to mock mode (SEV-2).
2. **Submit fails with `RPC_FAILED`?**
   - Run `npm run smoke:genlayer:read case-rpc-breach-001`. If error returns
     `receipt not found` (decoded), Studionet is healthy → check wallet on the
     client. If anything else → Studionet outage, escalate SEV-2.
3. **Submit fails with `EXECUTION_FAILED`?**
   - Read the contract revert reason from cause.data.receipt.result. If
     `version mismatch` → roll back the most recent intake-form deploy.
4. **Audit log not writing?**
   - Check `.data/` is writable by the Node process. Restart with `node --version`
     ≥ 20. JSONL writer is append-only — no need to recover state.

## Escalation contacts

- App owner: ngh1105 (GitHub)
- GenLayer Studionet status: https://studio.genlayer.com (manual check)

## Recovery actions

### Flip to mock mode

```bash
unset NEXT_PUBLIC_SLAPROOF_VERIFIER  # or set to "mock"
npm run dev   # or restart whatever supervisor runs the app
```

Receipts stored on the contract remain readable but the UI will not write new
ones until live mode is re-enabled.

### Roll back the contract

The current Phase 2 contract is `0x419D67e92855B94C0BF997638963961CA0A5dBC9` on
Studionet. Redeploy is non-destructive — old receipts stay readable at the old
address. Update `.env.local` to point at the new address only after the new
contract is verified via `npm run smoke:genlayer:read`.

### Reset rate limiter

Rate limit is in-memory, single-process. Restart the Node process to reset all
buckets. For a single user, the bucket auto-refills at ~1 token / 6s.

## After-incident

1. Append entry to `.data/audit.log.jsonl` with action `case_failed` if user
   work was lost.
2. Open a GitHub issue with: severity, timeline, root cause, mitigation.
3. If env config drifted, update `.env.local.example` so the next deploy lands
   correctly.
