# Production Readiness Checklist

Status legend: ✅ done · 🟡 partial · 🔴 not started

Last reviewed: 2026-05-30

## Product Claims

- ✅ The app says "SLA breach receipt" instead of "legal judgment".
- ✅ The app distinguishes public evidence from user-submitted excerpts.
- ✅ Inconclusive outcomes explain missing evidence.
- ✅ Exported receipts include confidence and limitations.
- ✅ Product copy does not imply automatic payout or enforceability.

## Security

- ✅ Secrets are never stored in frontend code.
- ✅ Users are warned not to paste private keys, API keys, or sensitive customer
  data into evidence fields. (12 patterns scanned client + server.)
- ✅ Evidence uploads and excerpts have size limits.
- ✅ Auth protects non-public workspaces (PILOT_TOKEN cookie + middleware).
- ✅ Rate limits protect case creation and login (token-bucket, in-memory).
- ✅ Receipt exports redact private workspace metadata (automated
  pattern-based scrub via `redactReceiptForExport`; manual review
  remains recommended for unusual incident notes).
- ✅ Dependencies are audited in CI (`npm audit --omit=dev --audit-level=high`).
- ✅ Default security headers + report-only CSP + violation report endpoint.
- ✅ CodeQL static analysis workflow (manual + weekly cron).
- ✅ Audit log redacts sensitive keys and truncates long strings.
- ✅ `/.well-known/security.txt` published.

## Privacy And Data Retention

- ✅ Data retention policy is documented (`docs/policies/data-retention-policy.md`).
- ✅ Users can delete draft cases.
- ✅ Final contract receipts are treated as public or semi-public artifacts.
- ✅ Private logs are not sent to the contract by default.
- ✅ Pasted excerpts are hashed and labeled.
- ✅ Audit log rotation script (50 MB threshold, --force override).

## Reliability

- ✅ Draft cases survive page reload.
- ✅ GenLayer write failures are retryable.
- ✅ Delayed finalization has a clear pending state.
- ✅ Contract read-back is required before showing finalized receipt.
- ✅ App has health endpoint (`/api/health`).
- ✅ App has error tracking (logger sink + reportError abstraction +
  optional remote webhook/Sentry sink wired via
  `instrumentation.ts` — `ERROR_WEBHOOK_URL` / `SENTRY_DSN`; runbook in
  `docs/runbooks/error-tracking-integration.md`).
- ✅ App has structured logs for case lifecycle events.
- ✅ Branded 404 + 500 error pages with reportError integration.
- ✅ Startup env validation via instrumentation hook (fail-fast in production).

## Contract Quality

- ✅ Contract methods are documented.
- ✅ Contract payload schema is versioned (`slaproof.case.v0`, `slaproof.receipt.v0`).
- ✅ Direct tests cover valid and invalid payloads.
- ✅ Tests cover breach, no breach, inconclusive, and needs more evidence.
- 🟡 GenVM lint passes (AST lint ✅; full `check` works after caching the
  v0.2.16 universal tarball — see workaround in
  `docs/runbooks/genlayer-deployment.md`).
- ✅ Deployment runbook exists.
- ✅ Contract address and network are visible in the app.
- ✅ Contract upgrade & deployment policy documented.

## Data Integrity

- ✅ Case ids are unique.
- ✅ Evidence ids are unique per case.
- ✅ Timestamps are normalized to UTC.
- ✅ Receipt hash is deterministic (FNV-1a).
- ✅ Receipt version is included and validated on read.
- ✅ Exported JSON validates against schema.

## Operations

- ✅ Production deploy runbook exists (Docker + GenLayer deploy runbooks).
- ✅ Rollback process exists (contract upgrade policy + incident runbook).
- ✅ Database backup and restore process exists (`npm run data:backup` /
  `data:restore` for file-store pilot data; `npm run db:backup` /
  `db:restore` for Postgres logical snapshots; provider PITR / `pg_dump`
  guidance in `docs/runbooks/postgres-backup-restore.md`).
- ✅ Incident response contact is defined.
- ✅ Manual case recovery process exists (data retention policy).
- ✅ GenLayer RPC outage fallback is documented.
- ✅ Multi-stage Dockerfile + docker-compose.
- ✅ External health monitor + ops report scripts + alerting runbook
  (`/api/alerts`, threshold env vars, and on-call rota template in
  `docs/runbooks/alerting.md`).
- ✅ x-request-id header for log correlation.

## Observability

- ✅ Track case created (counter + audit log).
- ✅ Track evidence added (per-evidence `evidence_added` audit event +
  `evidence_added` counter on case creation).
- ✅ Track submit started (verifier_submit_ok / errors).
- ✅ Track GenLayer transaction accepted (verifier_wait_ok).
- ✅ Track receipt read success.
- ✅ Track receipt read failure.
- ✅ Track export generated (export_receipt_json / _markdown counters).
- ✅ Monitor error rate, latency, and failed contract reads (`/api/metrics` +
  `/api/alerts`; critical alerts return 503 and can route through
  `reportError` / `ERROR_WEBHOOK_URL`).
- ✅ Operator-facing dashboard at `/ops` showing readiness + counters.
- ✅ `/api/health`, `/api/metrics`, `/api/alerts`, `/api/version`, `/api/audit` endpoints.

## Pilot Gate

Before a real pilot:

- ✅ Use a managed database (Postgres CaseStore via `SLAPROOF_STORE=postgres`
  and `DATABASE_URL`; file store remains default for local/demo mode).
- ✅ Protect workspace access.
- ✅ Provide evidence redaction guidance.
- ✅ Run at least three realistic incident cases.
- ✅ Review product language for legal overclaiming.
- 🟡 Verify live GenLayer receipt read-back (read path ✅; live write
  end-to-end verified via tx `0x204a31d397363a2151ecfa3218a501ebcc3cdf7d0ee0e5d343d1b0e9c07b221a`
  on Studionet — `case-rpc-write-001` receipt is readable on-chain).
- ✅ Document known limitations.
- ✅ Pilot threat model published (rev 2).
- ✅ Login brute-force protection (5 attempts / 5 min).

## Production Gate

Before public production:

- 🟡 Complete security review (prep package complete in
  `docs/security/external-security-review-prep.md`; awaiting external vendor).
- ✅ Complete threat model (production-scope threat model complete in
  `docs/security/threat-model-production.md`; residual risks tracked).
- 🟡 Complete contract audit or focused review (prep package complete in
  `docs/security/contract-review-prep.md`; awaiting vendor).
- ✅ Establish backup and restore (file-level scripts + Postgres logical
  `db:backup` / `db:restore` scripts; managed provider PITR / `pg_dump`
  guidance documented).
- ✅ Establish monitoring and alerting (`/api/metrics`, `/api/alerts`,
  threshold env vars, and on-call rota template documented).
- 🟡 Establish support and incident response (runbooks + alerting on-call rota
  template documented; named staffing to be filled before public launch).
- ✅ Establish data retention and deletion policy.

## Project Hygiene

- ✅ MIT LICENSE published.
- ✅ SECURITY.md disclosure policy.
- ✅ CONTRIBUTING.md workflow.
- ✅ CODEOWNERS file.
- ✅ Dependabot weekly updates.
- ✅ GitHub issue + PR templates.
- ✅ CHANGELOG covers every merged PR.
- ✅ Environment variables reference (`docs/runbooks/environment-variables.md`).
