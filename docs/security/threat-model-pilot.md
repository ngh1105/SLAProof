# SLAProof Threat Model (Pilot)

Date: 2026-05-26
Status: Draft for pilot scope only. Production threat model is Phase 4
follow-up.

## In-scope assets

| Asset | Where | Sensitivity |
|---|---|---|
| Pilot session token | cookie `pilot_token`, env `PILOT_TOKEN` | Medium — limits write access |
| Case JSON payloads | `.data/db.json`, GenLayer contract | Medium — may contain provider names + incident details |
| Audit log | `.data/audit.log.jsonl` | Medium — operational record |
| Receipt records | GenLayer Studionet contract `0x419D…dBC9` | Low — public on chain by design |
| Evidence excerpts | submitted by operator | **High** — could leak credentials if not redacted |
| GenLayer signing key | wallet (browser) or `GENLAYER_PRIVATE_KEY` (CLI smoke) | **High** — signs all writes |

## Trust boundaries

```
Operator (browser)
     │   pilot_token cookie + wallet signature
     ▼
Next.js server actions ─── .data/* (file store)
     │   genlayer-js
     ▼
GenLayer Studionet ─── SlaProofRpcVerifier
```

- Browser is untrusted; all server actions re-validate.
- File store trusts the server process; assumes single-process pilot.
- Contract trusts no one; validates payload version + required fields.

## Threats considered

### T1 — Credential leak in evidence
**Vector:** Operator pastes API key / private key / auth header in an evidence
excerpt. The excerpt is hashed and submitted to the contract — irrecoverable on
public chain.

**Mitigation:**
- Client-side scanner blocks 4 patterns (private key, Stripe, Google API key,
  auth header) before submission.
- Server action re-runs the scan in `validateCasePayload` so a bypassed client
  cannot reach storage.
- Operator guide + redaction checklist call this out.

**Residual risk:** Patterns we haven't seen yet pass through. Need a periodic
review of incident types.

### T2 — Stolen pilot token
**Vector:** Attacker obtains `pilot_token` cookie (XSS, log exposure, shared
link).

**Mitigation:**
- Cookie is `httpOnly`, `sameSite=lax`, `secure` in production.
- Server action checks token on every write.
- Token is one shared secret per environment; rotate by changing `PILOT_TOKEN`
  env var and restarting.

**Residual risk:** No per-user audit beyond IP. Phase 5 needs per-operator
identity.

### T3 — Rate-limit bypass via IP rotation
**Vector:** Attacker rotates source IPs to exceed 5 cases per ~30s.

**Mitigation:**
- Rate limiter is in-memory; production needs Redis-backed key on token + IP.
- Pilot deployment is behind a single proxy that sets `x-forwarded-for`
  reliably.

**Residual risk:** Multi-instance pilot has independent buckets per pod.

### T4 — Malicious payload to verifier
**Vector:** Attacker submits crafted JSON to make the verifier judge a clean
provider as breach.

**Mitigation:**
- Server validates schema version, required fields, evidence shape.
- Contract re-validates `_validate_case` and refuses bad payloads.
- LLM prompt wraps user input in `<user_controlled_data>` tags and explicitly
  ignores any embedded instructions.

**Residual risk:** Prompt injection is an open research area. Independent
validators in GenLayer reduce single-validator manipulation.

### T5 — Storage corruption
**Vector:** Concurrent writes corrupt `db.json` or `audit.log.jsonl`.

**Mitigation:**
- `case-store.ts` uses atomic write (`tmp + rename`) with file lock.
- Audit log is append-only; partial lines are tolerated by `readAudit`.
- Read failures throw instead of falling back to seed (prevents silent data
  loss — see PR #7 review).

**Residual risk:** File store is a pilot expedient. Phase 4 must move to
managed Postgres before scale.

### T6 — Contract upgrade introduces breach in receipt schema
**Vector:** New contract deploy returns a receipt shape the app doesn't
understand. Users see broken receipts.

**Mitigation:**
- `lib/domain/receipt-versions.ts` declares `SUPPORTED_RECEIPT_VERSIONS`.
- `fromContractReceipt` throws `MISSING_RECEIPT` on unsupported version, which
  the UI surfaces as "Receipt not yet available."
- Old receipts at the previous contract address remain readable; rollback path
  is documented in `incident-response.md`.

**Residual risk:** A schema-breaking upgrade still requires a coordinated app
release.

### T7 — RPC endpoint outage during demo
**Vector:** Studionet RPC down → submit fails, demo stalls.

**Mitigation:**
- Health endpoint returns 503 when verifier not ready.
- Operator can flip `NEXT_PUBLIC_SLAPROOF_VERIFIER` to `mock` and continue
  with seeded receipts.
- Tx state machine surfaces `RPC_FAILED` with retry button.

**Residual risk:** No automatic failover to a secondary RPC.

### T8 — Sensitive data in audit log
**Vector:** Audit log captures provider name + chain in `details`. If a pilot
operator logs PII, it lands on disk.

**Mitigation:**
- Audit details are limited to non-evidence fields (provider name, chain).
- File is gitignored and never leaves the host.

**Residual risk:** No active redaction in `appendAudit`. Operator discretion.

## Out-of-scope (production threat model will cover)

- Smart contract upgrade / pause governance
- Multi-tenant access control (per-operator roles)
- Wallet key custody (currently delegated to browser extension)
- Long-haul DDoS / capacity planning
- Backup/restore for managed Postgres
- Supply-chain attacks on `genlayer-js` and `next` deps
- Data retention + GDPR-style deletion requests

## Review cadence

- Every contract upgrade: re-review T4, T6.
- Every scanner pattern change: re-review T1.
- Quarterly: full re-read with current incident log.

## References

- Production readiness checklist: `docs/readiness/production-readiness-checklist.md`
- Incident runbook: `docs/runbooks/incident-response.md`
- Pilot operator guide: `docs/runbooks/pilot-operator-guide.md`
