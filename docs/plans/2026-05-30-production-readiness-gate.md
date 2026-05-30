# Production Readiness Gate — Implementation Plan

Date: 2026-05-30
Design: `docs/plans/2026-05-30-production-readiness-gate-design.md`
Branch: `feat/production-readiness-gate` (off `origin/master`, includes Postgres)

Execution: subagent-driven, TDD, one commit per task. Each task is a fresh
subagent that writes a failing test, implements, watches it pass, then commits.

Conventions:
- Test runner: `npx vitest run <file>` for the touched suite.
- Gate before commit: `npm run lint && npm run typecheck`.
- Commit style: Conventional Commits, one commit per task.
- Do NOT exceed the files listed per task (no scope creep).

---

## Workstream A — Postgres operations

### Task A1 — `dumpCases` / `loadCases` library helpers

Goal: pure, testable backup/restore core decoupled from the CLI.

Files:
- `lib/storage/pg-backup.ts` (new)
- `tests/unit/pg-backup.test.ts` (new)

Spec:
- `dumpCases(store: CaseStore): Promise<BackupSnapshot>` returns
  `{ takenAt: ISO, store: "postgres", count, rows: SlaCase[] }` by calling
  `store.list()`.
- `restoreCases(store: CaseStore, snapshot: BackupSnapshot): Promise<number>`
  upserts each row via `store.save()` and returns the count restored.
- `restoreCases` validates the snapshot shape; throws on missing `rows`.
- No direct `pg` import here — operate through the `CaseStore` interface so
  tests use an in-memory fake.

TDD:
1. Test: `dumpCases` over a fake store with 2 cases → snapshot.count === 2,
   rows match, `store` field === "postgres".
2. Test: `restoreCases` into an empty fake store → both saved, returns 2.
3. Test: `restoreCases` with malformed snapshot (no rows) → throws.

Commit: `feat(db): backup/restore core helpers (dumpCases/restoreCases)`

---

### Task A2 — `db:backup` CLI script

Goal: env-guarded CLI that snapshots postgres `cases` to disk with rotation.

Files:
- `scripts/db-backup.mjs` (new)
- `package.json` (add `"db:backup"` script)
- `tests/unit/db-backup-cli.test.ts` (new — argument/guard parsing only)

Spec:
- Skips with exit 0 + message when `SLAPROOF_STORE !== "postgres"`.
- Writes `.data/pg-backups/slaproof-pg-<stamp>.json` from the dump snapshot.
- `--keep N` prunes oldest, validates N is a positive integer (exit 2 on bad).
- Mirrors `scripts/backup-data.mjs` structure/logging for consistency.

TDD:
1. Test: `--keep` argument parsing rejects non-positive / NaN (exit code 2).
2. Test: mode-guard logic returns the skip path when store is not postgres.
   (Extract the pure helpers into the script and import them, or test via a
   thin exported function — keep network/db out of the unit test.)

Commit: `feat(db): db:backup CLI for postgres cases (with --keep rotation)`

---

### Task A3 — `db:restore` CLI script

Goal: env-guarded CLI to restore a snapshot into postgres, with overwrite guard.

Files:
- `scripts/db-restore.mjs` (new)
- `package.json` (add `"db:restore"` script)
- `tests/unit/db-restore-cli.test.ts` (new — guard/arg parsing only)

Spec:
- Requires a snapshot path argument; exit 2 if missing.
- Skips with a clear error when `SLAPROOF_STORE !== "postgres"`.
- Refuses to restore into a non-empty `cases` table unless `--force` is set
  (check via `store.list()` length); exit 3 on guard trip without `--force`.
- On success prints the restored count.

TDD:
1. Test: missing path arg → exit 2.
2. Test: overwrite-guard helper returns "blocked" when table non-empty and no
   `--force`, "allowed" with `--force`.

Commit: `feat(db): db:restore CLI with non-empty overwrite guard`

---

## Workstream B — Monitoring & alerting

### Task B1 — pure alert evaluator

Goal: pure function that turns a metrics snapshot into a list of alerts.

Files:
- `lib/observability/alerts.ts` (new)
- `tests/unit/alerts.test.ts` (new)

Spec:
- `evaluateAlerts(snapshot: MetricsSnapshot, thresholds?: AlertThresholds): Alert[]`.
- `AlertThresholds` defaults: errorRateMax 0.05, latencyMsMax 2000,
  failedReadsMax 5. Resolve from env (`ALERT_ERROR_RATE_MAX`,
  `ALERT_LATENCY_MS_MAX`, `ALERT_FAILED_READS_MAX`) via a
  `resolveThresholds(env)` helper.
- Error rate = error-counter / request-counter (0 when no requests; never NaN).
  Use the actual counter names present in `lib/observability/metrics.ts`
  usage — the subagent must grep the codebase for the real counter keys
  (e.g. request total, error total, receipt read failure) and map them; do
  not invent metric names.
- Each `Alert` = `{ key, level: "warn"|"critical", value, threshold, message }`.
- Returns `[]` when everything is under threshold.

TDD:
1. Test: snapshot under all thresholds → `[]`.
2. Test: error rate above max → one alert with correct key/value.
3. Test: latency max above threshold → alert.
4. Test: failed reads above threshold → alert.
5. Test: zero requests → no divide-by-zero, no error-rate alert.
6. Test: `resolveThresholds` reads env overrides and falls back to defaults.

Commit: `feat(observability): pure threshold-based alert evaluator`

---

### Task B2 — alert notifier via reportError

Goal: fire alerts through the existing error sink; silent when healthy.

Files:
- `lib/observability/alert-notifier.ts` (new)
- `tests/unit/alert-notifier.test.ts` (new)

Spec:
- `notifyAlerts(alerts: Alert[], report = reportError): void`.
- For each alert, call `report(new Error(alert.message), { kind: "alert",
  alertKey: alert.key, level: alert.level, value, threshold })`.
- No alerts → no calls (assert `report` not invoked).
- Never throws (reportError already swallows sink errors).

TDD:
1. Test: two alerts → spy report called twice with alert context.
2. Test: empty list → report never called.

Commit: `feat(observability): alert notifier routes breaches to reportError`

---

### Task B3 — `/api/alerts` endpoint

Goal: surface current alert state for the ops dashboard / external monitor.

Files:
- `app/api/alerts/route.ts` (new)
- `tests/unit/alerts-route.test.ts` (new)

Spec:
- GET returns `{ ok: boolean, alerts: Alert[], evaluatedAt: ISO }` where
  `ok === (alerts.length === 0)`.
- Builds the snapshot from `snapshot()` and runs `evaluateAlerts`.
- Returns HTTP 200 when ok, 503 when any `critical` alert is present (mirror
  the `/api/health` 503-on-failure convention).
- No auth required (same posture as `/api/health` and `/api/metrics`) —
  the subagent must confirm those routes are unauthenticated and match.

TDD:
1. Test: healthy snapshot → 200, ok true, empty alerts.
2. Test: critical alert present → 503, ok false.

Commit: `feat(observability): /api/alerts endpoint (503 on critical)`

---

## Workstream C — Production documentation

### Task C1 — complete production threat model

Goal: promote `docs/security/threat-model-production.md` from draft to complete.

Files:
- `docs/security/threat-model-production.md` (edit)

Spec:
- Remove all TODO/draft markers.
- Cover: assets, trust boundaries, STRIDE per boundary, the Postgres data
  store (new attack surface), alerting/observability surface, and residual
  risks with mitigations referencing existing controls.
- Cross-reference the pilot threat model; note what changes at production scale.

Verify: `grep -ri "TODO\|draft\|TBD" docs/security/threat-model-production.md`
returns nothing (other than perhaps a "supersedes draft" note).

Commit: `docs(security): complete production-scope threat model`

---

### Task C2 — external review prep checklists

Goal: make commissioning the external security review + contract audit cheap.

Files:
- `docs/security/external-security-review-prep.md` (new)
- `docs/security/contract-review-prep.md` (new)

Spec:
- Security review prep: scope, in/out of scope, asset inventory, auth model,
  data flows, known limitations, prior internal findings, contact + artifacts
  to hand the vendor.
- Contract review prep: contract surface, payload schemas/versions, state
  transitions, threat assumptions, test coverage summary, deployment policy.
- Both end with a "status: prepared, awaiting vendor" line.

Commit: `docs(security): external security + contract review prep checklists`

---

### Task C3 — ops runbooks + readiness checklist update

Goal: document the new tooling and flip gate items; the closing task.

Files:
- `docs/runbooks/postgres-backup-restore.md` (new)
- `docs/runbooks/alerting.md` (new)
- `docs/readiness/production-readiness-checklist.md` (edit)

Spec:
- Backup/restore runbook: `db:backup`/`db:restore` usage, rotation,
  migrate-on-deploy order, and the `pg_dump`/PITR note delegating physical
  backup to the managed provider.
- Alerting runbook: thresholds + env vars, `/api/alerts`, how breaches route
  through `reportError`/`ERROR_WEBHOOK_URL`, plus an on-call rota template.
- Readiness checklist: flip managed-DB, backup/restore, and
  monitoring/alerting items to ✅ where criteria now hold; annotate external
  security review + contract audit as "prep complete, awaiting vendor";
  bump "Last reviewed" date.

Verify: `npm run readiness:check` (if it parses the checklist) still passes;
links resolve.

Commit: `docs(ops): backup/restore + alerting runbooks; update readiness gate`

---

## Execution order

A1 → A2 → A3 → B1 → B2 → B3 → C1 → C2 → C3.

A1–A3 and B1–B3 are internally sequential (each builds on the prior). C1 and
C2 are independent of A/B and of each other — they may run in parallel once
code tasks land. C3 is the closing task and must run last (it documents the
shipped tooling and flips the gate).

Per-task loop (each task):
1. Spawn implementer subagent with this plan + the task block + design doc.
2. On completion, spawn spec-reviewer (matches spec, no scope creep).
3. Spawn code-quality reviewer (TDD followed, quality acceptable).
4. Fix issues if raised; re-review.
5. Confirm the commit landed; move on.

Final: holistic review subagent over the whole branch, then Phase 5
(finish-branch): verify full suite + build, then push + open PR for approval.
