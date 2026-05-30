# Production Readiness Gate — Closure Design

Date: 2026-05-30
Branch: `feat/production-readiness-gate`
Author: subagent-driven workflow (superpowers)

## Goal

Close the automatable 🟡 items remaining on the Production Gate after the
Postgres migration (PR #98) landed. Three workstreams: Postgres operations,
monitoring & alerting, and production-scope documentation.

## Scope

### In scope (subagents can complete)

Workstream A — Postgres operations
- `db:backup` — logical export of the `cases` table to a timestamped JSON
  snapshot, env-guarded to postgres mode, with `--keep N` rotation.
- `db:restore` — restore a snapshot into Postgres (idempotent upsert), with a
  `--force` guard to prevent accidental overwrite.
- Backup/restore + migrate-on-deploy runbook section.

Workstream B — Monitoring & alerting
- Threshold-based alert evaluator over the metrics snapshot (error rate,
  request latency p-max, failed contract reads).
- Alert notifier that reuses the existing `reportError` sink / `ERROR_WEBHOOK_URL`
  so a breach fires an outbound event (no new transport).
- `/api/alerts` (or extend ops report) surfacing current alert state.
- Alerting runbook + on-call rota template.

Workstream C — Production documentation
- Complete the production threat model (promote from draft to complete).
- External security-review prep checklist (scope, assets, boundaries).
- Contract focused-review prep checklist.

### Out of scope (require external parties — prep only)

- Actual external security review execution.
- Actual third-party contract audit.
These stay 🔴 on the gate; subagents produce the prep docs that make them
cheap to commission, and the checklist notes them as "prepared, awaiting
vendor".

## Key design decisions

### A. Backup via pg client logical export, not `pg_dump`

The existing file backup (`scripts/backup-data.mjs`) writes a JSON snapshot.
We mirror that shape for Postgres: query all rows from `cases`, write
`{ takenAt, store: "postgres", rows: [...] }`. Rationale:
- No dependency on a `pg_dump` binary being present in the deploy image.
- Testable with the same env-guard pattern as the integration tests.
- Restore is a plain idempotent upsert loop, symmetric with the seed script.
`pg_dump`/`pg_restore` remain documented in the runbook as the
production-grade physical-backup alternative (PITR, WAL), which a managed DB
provider (RDS/Neon/Supabase) typically handles natively.

### B. Alerting reuses existing sinks, adds no new transport

`reportError` already supports an injectable sink and `ERROR_WEBHOOK_URL` is
wired at startup. The alert evaluator computes booleans from a metrics
snapshot and, on breach, calls `reportError` with an `alert` context. This
keeps the blast radius tiny and means alerts ride the same delivery path the
ops team already configured. Thresholds are env-tunable with safe defaults.

### C. Thresholds (defaults, env-overridable)

- `ALERT_ERROR_RATE_MAX` — default 0.05 (5% of requests erroring).
- `ALERT_LATENCY_MS_MAX` — default 2000 (request histogram max).
- `ALERT_FAILED_READS_MAX` — default 5 (failed contract reads since boot).
Evaluator is pure (snapshot in → alert list out) so it is unit-testable
without timers or network.

### D. TDD + one commit per task

Every task: write failing test → implement → green → commit. One commit per
task, conventional-commit messages, matching the Postgres run.

## Success criteria

1. `db:backup` exports postgres `cases` to a snapshot; skips cleanly in file
   mode; `--keep N` rotates.
2. `db:restore` reloads a snapshot idempotently; refuses to clobber without
   `--force`.
3. Alert evaluator flags error-rate, latency, and failed-read breaches from a
   snapshot; passes when under threshold.
4. Alert notifier fires through `reportError` on breach and is silent when
   healthy.
5. Alert state is observable via an endpoint/script.
6. Production threat model is complete (no TODO/draft markers).
7. Security-review and contract-review prep checklists exist and are linked
   from the readiness checklist.
8. Readiness checklist updated: managed-DB, backup/restore, and
   monitoring/alerting flip from 🟡 to ✅ where criteria are met; external
   items annotated "prep complete, awaiting vendor".
9. Lint, typecheck, full test suite, and build all pass.

## Non-goals

- Replacing the in-memory metrics with OpenTelemetry (separate effort).
- Standing up real infra (S3 buckets, PagerDuty) — we ship the code + docs
  that plug into them.
- Physical/PITR backups — documented, delegated to the managed DB provider.
