# Changelog

All notable changes are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows
the production roadmap phases instead of semver until a stable release ships.

## Unreleased

### Checklist closeout

- Per-evidence audit events emitted on case creation (`evidence_added`)
  with metric counter (closes Observability checklist gap).
- Receipt JSON + Markdown export pipeline runs every receipt through
  `redactReceiptForExport`, which scans `validatorReasoning`,
  `recommendedNextAction`, `violatedClauses`, and evidence citations
  for known credential patterns and replaces matches with deterministic
  `[REDACTED:<kind>]` markers; redactions bump the
  `export_receipt_redacted` counter and log a structured warning
  (closes manual-review export gate in production readiness checklist).
- Optional remote error sink (`ERROR_WEBHOOK_URL` / `SENTRY_DSN`)
  wired through `instrumentation.ts` so `reportError()` can ship to
  Sentry, Datadog, or any compatible ingest endpoint without changing
  call sites; default logger sink remains the fallback.
- Shared sensitive-data scanner (`lib/security/sensitive-scanner.ts`)
  consolidates the credential pattern list used by case payload
  validation and export redaction.

### Phase 4 — Production hardening (in progress)

- Token-bucket rate limiter on `createCaseAction` (PR #17)
- Structured JSON logger with pluggable sink (PR #18)
- `/api/health`, `/api/metrics`, `/api/version` endpoints (PR #19, #22, #34)
- Incident response runbook + contract upgrade policy + data retention policy
  + pilot threat model (PR #20, #23, #24, #25)
- Metrics collector with counters and histograms (PR #21)
- Verifier submit/wait/getReceipt instrumentation (PR #26, #37)
- npm audit gate in CI (PR #30)
- Default security headers + report-only CSP + CSP report endpoint (PR #31, #39, #47)
- Error reporter abstraction wired into createCaseAction and verifier (PR #32, #41)
- Startup env validation via instrumentation hook (PR #35, #36)
- Audit log rotation script (PR #38)
- Pilot data backup + restore scripts (PR #40)
- Production readiness checklist updated with status indicators (PR #27)
- Lint cleanup (PR #33)
- 404 + 500 error pages with reportError integration (PR #52)
- Receipt export counters (PR #54)
- /ops dashboard for verifier readiness + metrics (PR #55)
- External health monitor script (PR #56)
- API route unit tests (PR #45)
- /api/audit endpoint with caseId filter + tests (PR #59, #60)
- x-request-id header in middleware (PR #61)
- Login rate limit + metrics (PR #62)
- CSP report endpoint tests (PR #63)
- CodeQL workflow (PR #65)
- /.well-known/security.txt (PR #66)
- Threat model rev 2 (PR #58)
- Receipt export + contract payload tests (PR #69, #70)
- Multi-stage Dockerfile + docker-compose + deployment runbook (PR #71, #72, #73)
- Hash + verifier-factory + mock-adapter unit tests (PR #82, #83, #87)
- robots.txt blocks pilot indexing (PR #77)
- Environment variables reference + error tracking integration guide (PR #78, #79)
- Audit log details redaction (PR #75)
- Onboarding guide (PR #86)
- Playwright report uploaded on failure (PR #84)
- v8 coverage with thresholds + CI artifact (PR #85, #89, #90)
- Docker image revision/created labels + commit SHA env (PR #88)
- E2E coverage of /ops, /audit, /api routes (PR #80)
- Readiness checklist refresh #2 (PR #81)
- CHANGELOG covering PRs #58-#73 (PR #74)

### Phase 3 — Pilot readiness

- SLA template library with 4 vendor-neutral tiers (PR #11)
- Audit log JSONL + viewer page at `/audit` (PR #12, #13)
- Receipt version negotiation in adapter (PR #14)
- Monitoring CSV parser + intake form integration (PR #15, #16)
- CaseStore interface + in-memory implementation + file-store adapter (PR #28, #29)
- Sensitive credential scanner expanded to 12 patterns (PR #53)

### Phase 2 — GenLayer Live MVP

- `SlaProofRpcVerifier` deployed to Studionet at
  `0x419D67e92855B94C0BF997638963961CA0A5dBC9` (PR #10)
- Smoke read script handles "receipt not found" gracefully
- Wallet hook + tx state machine + submit panel (earlier PRs)
- Receipt page refresh + contract metadata (earlier PRs)
- **Live write verified end-to-end**: tx `0x204a31d397363a2151ecfa3218a501ebcc3cdf7d0ee0e5d343d1b0e9c07b221a` on Studionet → receipt `case-rpc-write-001` readable on-chain. Smoke script payload aligned with contract validator (`version` field, empty-hash bypass).
- Full `genvm-lint check` passes after caching v0.2.16 SDK tarball under the latest-tag name (PR #94).

### Phase 1 — Local Demo MVP (baseline)

- Initial app shell, seeded cases, mock verifier, exports (earlier PRs)
- Hardened pilot intake: server-side validation + audit gate (PR #7)

### Project hygiene

- CHANGELOG, SECURITY policy, CONTRIBUTING guide (PR #42, #43, #44)
- Organized README doc map (PR #46)
- Dependabot config + GitHub issue/PR templates (PR #48, #51)
- MIT LICENSE (PR #64)
- CODEOWNERS (PR #67)
- README badges (PR #68)

## Status snapshot

| Phase | Progress |
|---|---|
| Phase 0 Design package | 100% |
| Phase 1 Local Demo MVP | 100% |
| Phase 2 GenLayer Live MVP | 100% (live write end-to-end verified — tx `0x204a31d3…f378e952` on Studionet) |
| Phase 3 Pilot readiness | ~95% (managed DB blocked, interface ready) |
| Phase 4 Production hardening | ~98% (Sentry sink + alerting wiring + contract audit pending) |
| Phase 5 Expansion | 0% (planned) |
