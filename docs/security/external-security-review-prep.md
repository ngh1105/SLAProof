# External Security Review — Prep Checklist

Date: 2026-05-30
Owner: SLAProof maintainers
Purpose: package everything a third-party security reviewer needs so the
engagement can start without a discovery phase. This document does **not**
perform the review; it is the briefing pack and access checklist handed to the
vendor.

This feeds the "Complete security review (external)" item in the
[Production Readiness Checklist](../readiness/production-readiness-checklist.md)
Production Gate.

## Review scope

### In scope

- The Next.js web app: case intake, evidence workspace, receipt viewer/exporter
  (`app/`, `lib/`).
- Authentication and session handling: `PILOT_TOKEN` cookie + `middleware.ts`,
  the login server action, and the planned per-operator identity model
  (see P1 in the production threat model).
- Rate limiting: in-memory token-bucket limiter on case creation and login,
  including the documented login brute-force protection (5 attempts / 5 min).
- Input handling and evidence redaction: client + server secret-pattern
  scanning, `redactReceiptForExport`, evidence size limits.
- The Postgres case store adapter (`lib/storage/`) and its query surface —
  the new production data store.
- The unauthenticated observability endpoints (see dedicated section below).
- Error/observability data paths: `reportError`, optional `ERROR_WEBHOOK_URL`
  / `SENTRY_DSN` remote sink, audit log redaction.
- Security headers, report-only CSP, and the CSP violation report endpoint.
- Secret handling and env validation (`lib/config/env-validation.ts`,
  `instrumentation.ts`).

### Out of scope

- The GenLayer Intelligent Contract evaluator and verdict logic — that is
  covered by a separate engagement; see
  [contract-review-prep.md](./contract-review-prep.md).
- GenLayer protocol / network-level security (validator consensus, RPC
  infrastructure run by GenLayer).
- Managed-service internals that are the provider's responsibility (Postgres
  host hardening, object-storage backend, CDN/WAF internals) — review the
  app's *configuration* of these, not the providers themselves.
- Penetration testing of production infrastructure that does not yet exist
  (IdP, CDN/WAF, managed DB are still being selected — see open items).
- Continuous monitoring features and any roadmap "Future Extensions" not yet
  shipped (`docs/architecture/01-system-architecture.md`).

## Asset inventory

Drawn from the production threat model
([threat-model-production.md](./threat-model-production.md)) "New in-scope
assets" table plus the shipped pilot surface.

| Asset | Where | Sensitivity |
|---|---|---|
| Operator session / `PILOT_TOKEN` cookie | browser cookie + middleware | High — controls write access |
| Operator identities (production) | external IdP, not yet selected | High |
| Postgres `cases` data | managed Postgres (`lib/storage/` adapter) | Critical — production source of record |
| Backup snapshots | `.data/pg-backups/*.json` (file) / managed object storage (planned) | Critical — restore source |
| Pasted evidence excerpts | submitted in case payloads, hashed (FNV-1a) | Medium — user-provided, may carry PII |
| Exported receipts | JSON/Markdown downloads | Public / semi-public artifacts |
| Audit log | app-side, redacted + truncated | Medium |
| Error-tracker context | optional external sink via `reportError` | Medium — may capture exception context |
| Contract address (per env) | env var, pinned + validated | High — silent swap is an attack |
| Contract upgrade keys | wallet / multisig (planned) | Critical — controls deployment |

## Auth model

- **Pilot (shipped):** single shared `PILOT_TOKEN` (required ≥16 chars in
  production, enforced by `validateEnv`). The token is presented as a
  `pilot_token` cookie and checked in `middleware.ts`.
- **Protected paths:** `/` (root), `/cases/*`, `/receipt/*`. A missing/invalid
  cookie redirects to `/login`.
- **Bypassed / public paths:** `/login`, `/_next/*`, `/api/health`,
  `/api/csp-report`, `/favicon.ico`, and any path not in the protected set
  (this includes the other `/api/*` endpoints and the `/ops` + `/audit`
  pages — see next section).
- **When `PILOT_TOKEN` is unset** (e.g. local mock mode) middleware short-circuits
  and serves everything unauthenticated. Production env validation forces the
  token to be set.
- **Production target (not yet built):** per-operator identity via an external
  IdP with MFA, per-operator audit identity replacing the single "pilot"
  actor, session revocation, and a Redis-backed limiter for multi-instance.
  Tracked as P1 in the production threat model; IdP choice is an open blocker.

## Data flows

Primary write/verify path (client → app → Postgres → verifier):

1. **Client → App.** Operator drafts a case in the browser; the Next.js app
   validates required case / SLA / evidence fields and normalizes timestamps
   to UTC. Pasted evidence excerpts are hashed (FNV-1a) client-side.
2. **App → Postgres.** Draft cases persist through the `CaseStore` interface
   to the managed Postgres store so they survive reload and support
   backup/restore. Postgres is the app-side record, **not** the source of
   truth for a final verdict.
3. **App → Verifier (GenLayer contract).** The app serializes the
   `slaproof.case.v0` payload and sends a write transaction to the
   `SlaProofRpcVerifier` Intelligent Contract via `genlayer-js`.
4. **Verifier.** The contract fetches public evidence URLs where feasible,
   evaluates against SLA clauses, produces a verdict, and stores a compact
   `slaproof.receipt.v0` receipt by case id.
5. **Verifier → App.** The app reads the finalized receipt back from the
   contract (read-back required before showing a finalized receipt).
6. **App → Client.** The receipt renders and can be exported as JSON or
   Markdown.

Observability / error path: app code calls `reportError`, which logs locally
and optionally POSTs redacted context to `ERROR_WEBHOOK_URL` / a Sentry-style
sink. Counters and histograms are exposed via `/api/metrics`; alerts are
evaluated and exposed via `/api/alerts`.

Reference diagram and component breakdown:
`docs/architecture/01-system-architecture.md`.

## Unauthenticated observability endpoints

These routes are intentionally **not** behind the `PILOT_TOKEN` middleware
gate. The reviewer should confirm they expose no operator data or secrets and
that their failure modes are safe. Confirmed unauthenticated via `middleware.ts`
(only `/`, `/cases/*`, `/receipt/*` are protected):

| Endpoint | File | Returns | Notes |
|---|---|---|---|
| `GET /api/health` | `app/api/health/route.ts` | readiness status, verifier mode, DB ping | Explicitly allow-listed in middleware. 200 ok / 503 degraded. |
| `GET /api/metrics` | `app/api/metrics/route.ts` | counter + histogram snapshot | No per-case identifiers; aggregate counters. |
| `GET /api/alerts` | `app/api/alerts/route.ts` | `{ ok, alerts[], evaluatedAt }` | 200 healthy / 503 on any critical alert. |
| `GET /api/version` | `app/api/version/route.ts` | app version, commit SHA, supported receipt versions, contract address | Build/identity metadata. |
| `GET /api/audit` | `app/api/audit/route.ts` | last 50 audit events (redacted + truncated) | Reviewer should verify redaction is sufficient for an unauthenticated reader. |
| `POST /api/csp-report` | `app/api/csp-report/route.ts` | CSP violation sink | Allow-listed in middleware; DDoS target (see P4). |

The `/ops` (readiness + counters dashboard) and `/audit` (audit log viewer)
**pages** are also reachable without the token, since middleware only protects
`/`, `/cases/*`, and `/receipt/*`. Flag any data exposure here as in scope.

Specific questions for the reviewer:
- Is the `/api/audit` redaction (`redactDetails`) adequate for fully public
  exposure, or should this route move behind auth in production?
- Should `/api/metrics` / `/api/alerts` be rate-limited or cached at the edge
  to resist monitor floods (P4)?

## Known limitations and prior internal findings

These are self-identified; we surface them so the reviewer can confirm,
challenge, or de-prioritize rather than rediscover.

- **Single shared auth token.** Pilot uses one `PILOT_TOKEN`, not per-operator
  identity. No MFA, no session revocation. Production IdP not yet selected
  (P1, open blocker).
- **In-memory rate limiter.** Token-bucket limiter is per-process; it does not
  hold across multiple instances. Needs a Redis-backed limiter for production
  (carryover T3 / P1).
- **Error reporter does not redact.** The audit log redacts sensitive keys, but
  `error-reporter.ts` currently ships error context to the remote sink without
  the same `redactDetails` pass. Tracked as P5 — open work.
- **No SQL surface today, new adapter pending review.** The Postgres adapter is
  the new attack surface (P2); ORM/query-builder choice and least-privilege DB
  role must ship with this gate. Parameterization must be confirmed.
- **Backups are file-based in pilot.** `.data/pg-backups/*.json` snapshots are
  unencrypted local files; managed encrypted object storage is planned but not
  wired (P3).
- **CSP is report-only.** Not yet enforcing.
- **GenVM full `check` lint is gated.** Only AST lint + pytest + py_compile run
  locally due to an SDK download (HTTP 404) issue — see the contract README.
- **No secondary RPC failover** for GenLayer outages (carryover T7).
- **Unauthenticated observability surface** as listed above.

The full enumerated production threat list (P1–P9) and pilot carryovers
(T1–T8) live in [threat-model-production.md](./threat-model-production.md).
The shipped security controls are itemized in the
[Production Readiness Checklist](../readiness/production-readiness-checklist.md)
"Security" section.

## Artifacts and access to hand the vendor

- **Source repository:** `https://github.com/ngh1105/SLAProof` — grant read
  access to the security reviewer (or provide a tagged archive of the reviewed
  commit). Point them at the `feat/production-readiness-gate` branch state.
- **Threat models:**
  - Production: [docs/security/threat-model-production.md](./threat-model-production.md)
  - Pilot: `docs/security/threat-model-pilot.md`
- **Architecture:** `docs/architecture/01-system-architecture.md`
  (system + data flows), `docs/architecture/02-genlayer-contract-spec.md`.
- **Readiness gate:** `docs/readiness/production-readiness-checklist.md`.
- **Policies:** `docs/policies/contract-upgrade-policy.md`,
  `docs/policies/data-retention-policy.md`.
- **Runbooks:** `docs/runbooks/incident-response.md`,
  `docs/runbooks/postgres-deployment.md`,
  `docs/runbooks/genlayer-deployment.md`,
  `docs/runbooks/error-tracking-integration.md`.
- **Disclosure policy:** `SECURITY.md` and `/.well-known/security.txt`.
- **Environment variable inventory (names only, NO values):** see
  `docs/runbooks/environment-variables.md`. The vendor receives the variable
  **names and purposes**, never the secret values. The sensitive ones to flag
  but never share:
  - `PILOT_TOKEN` (auth secret)
  - `GENLAYER_PRIVATE_KEY` / `GENLAYER_PRV_KEY` / `GENLAYER_PRIVKEY` /
    `PRIVATE_KEY` (signing key — never committed, never shared)
  - `ERROR_WEBHOOK_URL` / `SENTRY_DSN` (sink endpoints)
  Public-config vars (`NEXT_PUBLIC_*`, contract address, RPC URL, chain id,
  network label) may be shared as-is — they ship to the client anyway.
- **Test/build commands** so the vendor can stand up the app locally:
  - `npm install`
  - `npm run dev` (mock mode, no env required)
  - `npm run lint` / `npm run typecheck`
  - `npm test` (vitest) / `npm run test:coverage`
  - `npm run test:e2e` (playwright)
  - `npm run build`
- **Contact:** route findings through the channel in `SECURITY.md`; the
  incident response contact is named in `docs/runbooks/incident-response.md`.

## Pre-engagement checklist

- [ ] Reviewer has repo read access (or a tagged source archive).
- [ ] Threat model + architecture docs shared.
- [ ] Env var inventory shared (names + purposes, **no secret values**).
- [ ] Scope (in/out) agreed and signed off.
- [ ] Disclosure / findings channel confirmed (`SECURITY.md`).
- [ ] Test environment reproducible from the documented commands.
- [ ] Open blockers (IdP, ORM, object storage) communicated as "planned, not
      yet built" so the reviewer scopes config review vs. implementation review
      correctly.

Status: prepared, awaiting vendor.
