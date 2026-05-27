# Onboarding Guide

A short walk through the codebase for someone joining the project. Reading time: ~15 minutes.

## What this is

SLAProof is a Next.js app + GenLayer Intelligent Contract that turns SLA
incident evidence into auditable receipts. The pilot ships in two modes:

- **Mock**: deterministic local verifier, no chain access. Default.
- **GenLayer**: live writes to `SlaProofRpcVerifier` on Studionet.

Toggle via `NEXT_PUBLIC_SLAPROOF_VERIFIER`. See `docs/runbooks/environment-variables.md`.

## Repo layout

```
app/                     Next.js App Router pages + server actions + API routes
contracts/               Python GenLayer Intelligent Contract + tests
lib/
  audit/                 Append-only JSONL audit log + redaction
  config/                Startup env validation
  domain/                Pure types, validation, hash, sla-templates, csv parser, fixtures
  export/                Receipt JSON + Markdown exporters
  genlayer/              Contract payload mappers (snake/camel)
  observability/         Logger, metrics, error reporter
  security/              Token-bucket rate limiter
  storage/               File-backed CaseStore + interface + in-memory impl
  verifier/              Mock + GenLayer adapters, factory, tx state machine
  wallet/                EIP-1193 provider detect, status hook
docs/
  architecture/          System + contract specs
  plans/                 Roadmap + implementation plans
  policies/              Contract upgrade + data retention
  readiness/             Production readiness checklist
  runbooks/              Deploy, incident, demo script, env vars, error tracking
  security/              Pilot threat model
  superpowers/           Specs + plans (used by AI tooling, optional reading)
  templates/             Evidence redaction + vendor escalation
public/                  Static assets (.well-known/security.txt, robots.txt)
scripts/                 CLI tools (smoke, backup/restore, audit:rotate, ops:report)
tests/
  unit/                  Vitest, lib/* + app/api/* coverage
  e2e/                   Playwright, mock-mode flows + ops pages
```

## First five minutes

```bash
git clone https://github.com/ngh1105/SLAProof.git
cd SLAProof
npm install
npm run dev
```

Open `http://localhost:3000`. The dashboard shows three seeded cases. Click
"Open breach case" → submit → see a deterministic receipt.

## First five tasks to read

If you have an hour, read these files in order:

1. `app/cases/new/actions.ts` — server action with auth + rate limit + audit
2. `lib/verifier/genlayer-adapter.ts` — chain gateway + tx state mapping
3. `lib/wallet/use-genlayer-wallet.ts` — EIP-1193 hook
4. `lib/observability/metrics.ts` + `error-reporter.ts` — observability primitives
5. `contracts/slaproof_rpc_verifier/main.py` — Python contract

## Quality gate (run before pushing)

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e        # optional locally; required in CI
npm run test:coverage   # optional; baseline ~80%
```

Contract tests:

```bash
py -3 -m pytest contracts/slaproof_rpc_verifier
```

## Common workflows

| Want to... | Run / read |
|---|---|
| Submit a case to mock verifier | open `/cases/<id>` and click submit |
| Read a deployed receipt | `npm run smoke:genlayer:read <caseId>` |
| Write a case from CLI (chain) | set `GENLAYER_PRIVATE_KEY`, run `npm run smoke:genlayer:write` |
| Snapshot pilot data | `npm run data:backup -- --keep 7` |
| Restore pilot data | `npm run data:restore -- <file>` |
| Rotate audit log | `npm run audit:rotate` |
| Health probe | `npm run check:health` |
| Ops snapshot | `npm run ops:report` |
| Add an SLA tier | edit `lib/domain/sla-templates.ts` + tests |
| Add a credential pattern | edit `lib/domain/case-payload.ts` + tests |
| Bump receipt version | follow `docs/policies/contract-upgrade-policy.md` |

## Operational endpoints

| Path | Purpose |
|---|---|
| `/api/health` | readiness, returns 200 ok / 503 degraded |
| `/api/metrics` | counters + histograms snapshot |
| `/api/version` | app + commit + receipt schema versions |
| `/api/audit?caseId=&limit=` | machine-readable audit log |
| `/api/csp-report` | CSP violation sink |
| `/audit` | human view of the audit log |
| `/ops` | dashboard: readiness + counters + schema |
| `/login` | pilot token entry (when `PILOT_TOKEN` is set) |

## Conventions worth knowing

- **No `console.log` in `lib/**`.** Use `log.{debug,info,warn,error}` from
  `lib/observability/logger.ts`. The default sink writes JSON-per-line.
- **Errors that should ship to Sentry/equivalent** go through `reportError(err, ctx)`.
  See `docs/runbooks/error-tracking-integration.md`.
- **Rate limit + audit + metrics** belong on every server action that writes.
  Match the pattern in `app/cases/new/actions.ts`.
- **Receipt schema version is checked** in `lib/genlayer/contract-payload.ts`.
  Bump versions through the contract upgrade policy.
- **Audit details get redacted** automatically (PR #75). Do not pass evidence
  excerpts; pass `caseId` and let the reader join.

## Where to ask questions

- Bug or feature? Open an issue using the templates in `.github/ISSUE_TEMPLATE/`.
- Security? Use the private advisory channel in `SECURITY.md`. Do not file a
  public issue.
- Contributing? Read `CONTRIBUTING.md`.

## Roadmap

Six phases. We're in Phase 4 (production hardening). See
`docs/plans/02-production-roadmap.md` and `docs/readiness/production-readiness-checklist.md`
for the live status board.
