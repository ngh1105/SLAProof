# Production Readiness Checklist

Status legend: ✅ done · 🟡 partial · 🔴 not started

Last reviewed: 2026-05-26

## Product Claims

- ✅ The app says "SLA breach receipt" instead of "legal judgment".
- ✅ The app distinguishes public evidence from user-submitted excerpts.
- ✅ Inconclusive outcomes explain missing evidence.
- ✅ Exported receipts include confidence and limitations.
- ✅ Product copy does not imply automatic payout or enforceability.

## Security

- ✅ Secrets are never stored in frontend code.
- ✅ Users are warned not to paste private keys, API keys, or sensitive customer
  data into evidence fields.
- ✅ Evidence uploads and excerpts have size limits.
- ✅ Auth protects non-public workspaces (PILOT_TOKEN cookie + middleware).
- ✅ Rate limits protect case creation (token-bucket, in-memory).
- 🟡 Receipt exports redact private workspace metadata (manual review only).
- 🔴 Dependencies are audited before production release (no `npm audit` in CI).

## Privacy And Data Retention

- ✅ Data retention policy is documented (`docs/policies/data-retention-policy.md`).
- ✅ Users can delete draft cases.
- ✅ Final contract receipts are treated as public or semi-public artifacts.
- ✅ Private logs are not sent to the contract by default.
- ✅ Pasted excerpts are hashed and labeled.

## Reliability

- ✅ Draft cases survive page reload.
- ✅ GenLayer write failures are retryable.
- ✅ Delayed finalization has a clear pending state.
- ✅ Contract read-back is required before showing finalized receipt.
- ✅ App has health endpoint (`/api/health`).
- 🟡 App has error tracking (structured logger only; no Sentry yet).
- ✅ App has structured logs for case lifecycle events.

## Contract Quality

- ✅ Contract methods are documented.
- ✅ Contract payload schema is versioned (`slaproof.case.v0`, `slaproof.receipt.v0`).
- ✅ Direct tests cover valid and invalid payloads.
- ✅ Tests cover breach, no breach, inconclusive, and needs more evidence.
- 🟡 GenVM lint passes (AST lint ✅; full `check` blocked by SDK 404 in local env).
- ✅ Deployment runbook exists.
- ✅ Contract address and network are visible in the app.

## Data Integrity

- ✅ Case ids are unique.
- ✅ Evidence ids are unique per case.
- ✅ Timestamps are normalized to UTC.
- ✅ Receipt hash is deterministic (FNV-1a).
- ✅ Receipt version is included.
- ✅ Exported JSON validates against schema.

## Operations

- ✅ Production deploy runbook exists.
- ✅ Rollback process exists (contract upgrade policy + incident runbook).
- 🔴 Database backup and restore process exists (file store has no backup).
- ✅ Incident response contact is defined.
- ✅ Manual case recovery process exists (data retention policy).
- ✅ GenLayer RPC outage fallback is documented.

## Observability

- ✅ Track case created (counter + audit log).
- 🟡 Track evidence added (covered by case_created; no per-evidence event).
- ✅ Track submit started (verifier_submit_ok / errors).
- ✅ Track GenLayer transaction accepted (verifier_wait_ok).
- ✅ Track receipt read success.
- ✅ Track receipt read failure.
- 🟡 Track export generated (no metric yet).
- 🟡 Monitor error rate, latency, and failed contract reads (metrics exist; no alerting).

## Pilot Gate

Before a real pilot:

- 🔴 Use a managed database (still file-backed JSON).
- ✅ Protect workspace access.
- ✅ Provide evidence redaction guidance.
- ✅ Run at least three realistic incident cases.
- ✅ Review product language for legal overclaiming.
- 🟡 Verify live GenLayer receipt read-back (read path ✅; live write end-to-end pending operator verification).
- ✅ Document known limitations.

## Production Gate

Before public production:

- 🔴 Complete security review.
- 🟡 Complete threat model (pilot scope ✅; production scope pending).
- 🔴 Complete contract audit or focused review.
- 🔴 Establish backup and restore.
- 🟡 Establish monitoring and alerting (metrics ✅; alerting not wired).
- 🟡 Establish support and incident response (runbook ✅; on-call rota not formalized).
- ✅ Establish data retention and deletion policy.

