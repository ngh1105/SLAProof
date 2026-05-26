# Changelog

All notable changes are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows
the production roadmap phases instead of semver until a stable release ships.

## Unreleased

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

### Phase 1 — Local Demo MVP (baseline)

- Initial app shell, seeded cases, mock verifier, exports (earlier PRs)
- Hardened pilot intake: server-side validation + audit gate (PR #7)

### Project hygiene

- CHANGELOG, SECURITY policy, CONTRIBUTING guide (PR #42, #43, #44)
- Organized README doc map (PR #46)
- Dependabot config + GitHub issue/PR templates (PR #48, #51)

## Status snapshot

| Phase | Progress |
|---|---|
| Phase 0 Design package | 100% |
| Phase 1 Local Demo MVP | 100% |
| Phase 2 GenLayer Live MVP | ~95% (live write end-to-end pending operator) |
| Phase 3 Pilot readiness | ~95% (managed DB blocked, interface ready) |
| Phase 4 Production hardening | ~95% (Sentry/alerting wiring + contract audit pending) |
| Phase 5 Expansion | 0% (planned) |
