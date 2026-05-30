# SLAProof Threat Model (Production)

Date: 2026-05-30
Status: Complete. Covers the production-scope architecture that ships on the
`feat/production-readiness-gate` branch: managed Postgres case store plus the
public observability/alerting surface. Supersedes the earlier scoping document
dated 2026-05-27.

## Scope and how this differs from the pilot

`threat-model-pilot.md` covers the single-host, single-operator pilot (file
store, one shared `PILOT_TOKEN`). This model covers the same application
deployed at production scale, where the concrete changes that have shipped are:

- A managed **Postgres** case store (`SLAPROOF_STORE=postgres`) replacing the
  file store as the system of record.
- A library-level **backup/restore** path (`db:backup` / `db:restore`) decoupled
  from any single host.
- A public **observability/alerting** surface: `/api/health`, `/api/metrics`,
  and `/api/alerts`.
- Startup **env validation** (`validateEnv`) that fails fast on missing or
  malformed configuration, including `DATABASE_URL`.

What has **not** changed yet, and is therefore still modeled on the pilot
posture: the auth model is still the shared `PILOT_TOKEN` (per-operator identity
is a planned future control, see P1), and the rate limiter is still in-memory.
Where a pilot threat (T1-T8) still applies, it is carried over below with its
production note rather than restated in full.

## In-scope assets

| Asset | Where | Sensitivity |
|---|---|---|
| Case JSON payloads (data at rest) | Postgres `cases` table, one JSONB blob per id | **High** — provider names + incident detail; system of record |
| Receipt records | GenLayer contract + mirrored in case data | Low — public on chain by design |
| Evidence excerpts | inside case payloads | **High** — could leak credentials if not redacted |
| Audit log | append-only operational record | Medium |
| `DATABASE_URL` | server env / secret store | **Critical** — full read/write to the case store |
| `PILOT_TOKEN` | server env, cookie on the client | High — gates all writes |
| `GENLAYER_PRIVATE_KEY` / wallet key | server env (CLI) or browser wallet | **High** — signs all on-chain writes |
| `ERROR_WEBHOOK_URL` + error context | server env, external sink | Medium — exception context can capture PII |
| Backup snapshots | `.data/pg-backups/*.json` (operator-managed) | **Critical** — restore source, full case dump |
| Metrics / alert state | in-process counters, exposed publicly | Low — counts, levels, thresholds only |

`DATABASE_URL` is a server-only secret. It is read via `process.env.DATABASE_URL`
in `lib/storage/case-store-postgres.ts` and is **never** given a `NEXT_PUBLIC_`
prefix, so it is not inlined into the client bundle. The same holds for
`PILOT_TOKEN`, `GENLAYER_PRIVATE_KEY`, and `ERROR_WEBHOOK_URL`. Only
`NEXT_PUBLIC_*` verifier/network config is intentionally client-visible.

## Trust boundaries

```
            Operator (browser, untrusted)
                 │  pilot_token cookie + wallet signature
                 ▼
        ┌──────────────────────────────────┐
   B1   │   Next.js server (app + actions)  │
 client │                                   │
  ↔ app │   validateEnv() at boot           │
        └───┬───────────────┬───────────┬───┘
            │ B2            │ B3         │ B4
            │ pg pool       │ genlayer-js│ public, unauth
            ▼               ▼            ▼
       Postgres        GenLayer /     /api/health
       `cases`         RpcVerifier    /api/metrics
       (JSONB)         (Studionet)    /api/alerts
```

The four production trust boundaries:

- **B1 — Client ↔ App.** The browser is untrusted. Every server action
  re-validates input, re-runs the credential scanner, and checks
  `pilot_token`. Crossing B1 inbound requires a valid token for writes.
- **B2 — App ↔ Postgres.** The app authenticates to a managed Postgres
  instance with `DATABASE_URL`. The DB trusts the app process; the app treats
  query results as its own data (the JSONB blob is the app's source of truth).
- **B3 — App ↔ GenLayer / verifier.** The app signs and submits payloads over
  `genlayer-js`. The contract trusts no caller and re-validates every payload;
  the app trusts the contract's receipt shape only for
  `SUPPORTED_RECEIPT_VERSIONS`.
- **B4 — App ↔ public observability.** `/api/health`, `/api/metrics`, and
  `/api/alerts` are reachable by anyone on the network with no authentication,
  by deliberate design (see the dedicated section below).

## STRIDE analysis per boundary

Each boundary is analyzed against Spoofing, Tampering, Repudiation,
Information disclosure, Denial of service, and Elevation of privilege. Only
the categories that carry real risk for that boundary are listed; "n/a" is
noted where a category does not meaningfully apply.

### B1 — Client ↔ App

- **Spoofing:** An attacker poses as a legitimate operator. Today this means
  presenting a stolen `pilot_token`. Mitigated by `httpOnly`/`sameSite`/`secure`
  cookie flags and a server-side token check on every write; the production
  upgrade is per-operator identity (P1).
- **Tampering:** Malicious request bodies aimed at the verifier or store.
  Server actions re-validate schema/version/required fields and re-run the
  credential scanner, so a tampered or scanner-bypassing client cannot reach
  storage (T1, T4).
- **Repudiation:** A writer denies an action. The append-only audit log records
  writes; the production gap is that the actor is still the shared token, so
  attribution is per-environment, not per-person (tracked under P1).
- **Information disclosure:** XSS or a leaked cookie exposes the session.
  Mitigated by CSP + security headers and the `httpOnly` cookie. No server
  secret is `NEXT_PUBLIC_`, so the client bundle carries no `DATABASE_URL`,
  token, or signing key.
- **Denial of service:** Flooding `/cases/new` or `/login`. Mitigated by the
  in-process rate limiter today; production needs edge rate limiting + a
  Redis-backed limiter for multi-instance correctness (P4, T3).
- **Elevation of privilege:** A reader becomes a writer. Writes require the
  token; reads do not grant write paths. Future per-operator roles harden this.

### B2 — App ↔ Postgres

- **Spoofing:** Anything holding `DATABASE_URL` is the database client. The
  string is a critical server-only secret (see the Postgres section); leakage
  is the dominant risk and is covered there.
- **Tampering / SQL injection:** All three store methods
  (`list`, `get`, `save` in `case-store-postgres.ts`) use **parameterized**
  queries (`$1`, `$2`) — no string interpolation into SQL. The `save` upsert
  binds `slaCase.id` and the JSONB blob as parameters. This closes the classic
  injection vector flagged as open in the prior scoping pass.
- **Repudiation:** `cases` rows carry `created_at` / `updated_at` (the upsert
  sets `updated_at = now()`), giving an ordering/recency trail alongside the
  audit log.
- **Information disclosure:** A compromised connection or over-broad DB role
  could read all case data. Mitigation is least-privilege CRUD on the app
  tables only and keeping `DATABASE_URL` out of any client-visible surface.
- **Denial of service:** A stuck or runaway query ties up the pool. Mitigated
  by `connectionTimeoutMillis: 5000` (fail fast when the DB is unreachable) and
  `statement_timeout: 10000` (server-side cap so one query can't hold a client
  forever). Both are set where the pool is created.
- **Elevation of privilege:** Avoided by not running the app as a Postgres
  superuser; the app role should be scoped to the `cases` table.

### B3 — App ↔ GenLayer / verifier

- **Spoofing:** The app pins the contract address per environment via
  `NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS`, validated at boot by `validateEnv`
  against a strict `0x`+40-hex pattern. A silent address swap requires an env
  change, not just a network trick.
- **Tampering:** A crafted payload tries to force a wrong verdict. The contract
  re-validates every payload (`_validate_case`) and the LLM prompt wraps user
  input and ignores embedded instructions (T4). Independent GenLayer validators
  reduce single-validator manipulation.
- **Repudiation:** On-chain writes are signed and publicly recorded; the
  receipt is the non-repudiable artifact.
- **Information disclosure:** Evidence is hashed before submission and the
  credential scanner blocks secret patterns, so raw secrets should not reach
  the public chain (T1).
- **Denial of service:** RPC outage stalls submits. Mitigated by 503 health
  gating and an operator fallback to `mock`; automatic secondary-RPC failover
  is still open (T7).
- **Elevation of privilege:** Contract upgrade authority is the high-value
  target — covered as a residual risk (contract upgrade keys / multisig).

### B4 — App ↔ public observability (unauthenticated)

- **Spoofing / Elevation:** n/a — read-only endpoints that expose no write path
  and no action. There is nothing to elevate into.
- **Tampering:** n/a — `GET` only; `/api/metrics` and `/api/alerts` are pure
  reads of in-process state.
- **Repudiation:** n/a.
- **Information disclosure:** This is the real category for B4. The endpoints
  expose operational telemetry (and, for `/api/alerts`, threshold/breach
  detail). This is a **deliberate, documented decision** — see the dedicated
  section below for exactly what is exposed and why no auth is added.
- **Denial of service:** Monitor floods. Mitigated by edge caching of
  `/api/health` and CDN/WAF absorption (P4). The endpoints do no heavy work:
  `/api/metrics` and `/api/alerts` read in-memory counters; `/api/health`
  performs one lightweight DB ping.

## New attack surface: the Postgres data store

The managed Postgres store (`lib/storage/case-store-postgres.ts`, selected by
`SLAPROOF_STORE=postgres` in `case-store-factory.ts`) replaces the file store
as the system of record and is the single largest new attack surface in
production. Concrete properties as shipped:

- **Connection string handling.** `DATABASE_URL` is read only on the server
  (`getPool(process.env.DATABASE_URL)`). It has no `NEXT_PUBLIC_` prefix, so
  Next.js never inlines it into the client bundle. `validateEnv` requires it to
  match a `postgres://` / `postgresql://` pattern and **fails boot in
  production** when `SLAPROOF_STORE=postgres` and the URL is missing or
  malformed — misconfiguration cannot silently fall back to an insecure state.
- **JSONB blob model.** Each case is one JSONB blob keyed by `id`
  (`INSERT ... ON CONFLICT (id) DO UPDATE`). The app treats the blob as its
  source of truth; SQL columns (`created_at`, `updated_at`) exist only for
  ordering and operational queries. Because the blob is the whole case payload,
  the credential-scanner control at B1 is what keeps secrets out of it — the
  DB does no content filtering of its own.
- **No raw SQL string-building.** `list`, `get`, and `save` all use
  parameterized queries; user-controlled values (`caseId`, `slaCase.id`, the
  blob) are bound as `$1`/`$2`, never interpolated. This is the standing
  mitigation for SQL injection at B2.
- **Pool / statement timeouts.** The pool sets
  `connectionTimeoutMillis: 5000` and `statement_timeout: 10000`. A DB outage
  fails fast rather than hanging request threads, and a single slow query is
  capped server-side so it cannot exhaust the pool — the resource-exhaustion
  control for B2.
- **Error path.** Every store method wraps failures with `reportError(...,
  { phase: "pgCaseStore.*" })` and rethrows. Read failures propagate (no silent
  fall-back to seed data), preserving the pilot's "fail loud over lose data"
  property (carryover from T5).
- **Backups.** `db:backup` / `db:restore` operate through the `CaseStore`
  interface. `db:restore` refuses to overwrite a non-empty `cases` table unless
  `--force` is passed (exit 3 otherwise) — the overwrite guard that prevents an
  accidental restore from clobbering live data. Snapshot files are full case
  dumps and inherit the same **High** sensitivity as the table itself.

## Public observability / alerting surface (documented decision)

`/api/health`, `/api/metrics`, and `/api/alerts` are **unauthenticated and
network-exposed by design**. This is a deliberate, recorded decision, not an
oversight — a reviewer specifically asked that the public posture be explicit.

What each endpoint exposes:

- **`/api/health`** — status (`ok`/`degraded`), uptime, version, verifier
  mode/readiness/network label, a boolean DB-reachability flag, and the Node
  version. Returns 503 when the verifier isn't ready or the DB ping fails.
- **`/api/metrics`** — the full in-process metrics snapshot (all counters and
  histograms). This endpoint is already **fully public**.
- **`/api/alerts`** — the output of `evaluateAlerts(snapshot())`: a list of
  `{ key, level, value, threshold, message }` objects plus an `ok` flag and
  `evaluatedAt`. So it discloses alert **keys** (`case_create_error_rate`,
  `latency_ms`, `failed_reads`), **levels** (`warn`/`critical`), the current
  **breaching value**, and the **configured threshold**. It returns 503 when any
  `critical` alert is present, mirroring `/api/health`'s 503-on-failure
  convention.

**Why no auth (rationale):**

- `/api/metrics` is already fully public, and `/api/alerts` is a strict
  **subset** of that same data — it derives every value it reports from the
  metrics snapshot via `evaluateAlerts`. Authenticating alerts while metrics
  stays open would protect nothing new.
- These endpoints exist to be scraped by external uptime monitors, load-balancer
  health checks, and dashboards, which are simplest and most reliable when
  unauthenticated. Health checks in particular must work before the app is
  fully "ready."
- They expose **no secrets and no PII**: only counts, levels, thresholds, and
  coarse status. There is no write path and no action to trigger — GET only
  (see B4 STRIDE).

**Residual risk + accepted rationale:** the surface gives an attacker free
reconnaissance — thresholds reveal where alerting fires, and breaching values
leak when the system is unhealthy (useful for timing a DoS). This recon risk is
**accepted**: the data is already low-sensitivity and largely public via
metrics, and the operational value of unauthenticated health/monitoring
outweighs the marginal recon exposure. The DoS angle is handled at the
transport layer (edge caching of `/api/health`, CDN/WAF; see P4), not by adding
auth. If a future requirement demands hiding thresholds, the right move is to
gate **both** `/api/metrics` and `/api/alerts` together behind the same
mechanism — gating only one is incoherent.

## Residual risks and mitigations

Each residual risk references an existing, shipped control.

| # | Residual risk | Mitigation (existing control) |
|---|---|---|
| R1 | `DATABASE_URL` leaks (logs, env dump) → full case read/write | Server-only env, no `NEXT_PUBLIC_`; `validateEnv` requires the `postgres://` form and fails boot in prod if missing/malformed |
| R2 | SQL injection via the new store | Parameterized `$1`/`$2` queries in `list`/`get`/`save`; no string-built SQL |
| R3 | Slow/stuck query exhausts the pool during a load spike | `connectionTimeoutMillis: 5000` + `statement_timeout: 10000` on the pool |
| R4 | Accidental restore clobbers live production data | `db:restore` overwrite guard — refuses non-empty `cases` table without `--force` (exit 3) |
| R5 | Secrets land in the JSONB blob on a public chain | Client + server credential scanner at B1; evidence hashed before submit (T1) |
| R6 | Public observability surface aids recon / DoS timing | Accepted decision (above); `/api/health` edge-cached + CDN/WAF (P4); endpoints expose no secrets/PII |
| R7 | DB unreachable serves stale/wrong "ok" | `/api/health` runs a DB ping and returns **503** when it fails; verifier-not-ready also 503 |
| R8 | Shared `PILOT_TOKEN` gives no per-person attribution | Token checked on every write + audit log; per-operator identity tracked as the top open item (P1) |
| R9 | Error context shipped to external sink leaks PII | Audit redaction exists; extend the same redaction into `error-reporter.ts` before it leaves the host (open, P5) |
| R10 | RPC outage stalls writes with no failover | 503 health gating + operator `mock` fallback (T7); automatic secondary RPC still open |
| R11 | Contract upgrade key compromise → malicious contract at a trusted-looking address | Address pinned per env + `validateEnv` hex check; append-only address registry; multisig + hardware keys (open, P6) |

The production-only threats from the original scoping pass (operator account
takeover, backup exfiltration, DDoS, error-tracker PII, contract-key
compromise, supply chain, future multi-tenant isolation, receipt-version
collision) remain valid and are tracked as P1-P9 in the open-work list below;
they are the forward-looking hardening items, distinct from the controls above
that have already shipped on this branch.

## Carryovers from the pilot (re-evaluated for production)

| Pilot ID | Production note |
|---|---|
| T1 (credential leak) | Still the primary B1/B3 control; the scanner is what keeps secrets out of the Postgres JSONB blob |
| T2 (stolen pilot token) | Still in effect; the per-operator-identity upgrade (P1) is the planned replacement |
| T3 (rate-limit bypass) | In-memory limiter still per-process; needs edge + Redis-backed limiter for multi-instance |
| T4 (malicious payload) | Unchanged; contract re-validation + prompt-injection guarding still apply |
| T5 (storage corruption) | Superseded by the managed DB; the "fail loud, don't lose data" property is preserved in the store's error path |
| T6 (receipt schema break) | `SUPPORTED_RECEIPT_VERSIONS` still enforced; coordinate schema-breaking upgrades with an app release |
| T7 (RPC outage) | Same; secondary-RPC failover remains unimplemented |
| T8 (audit PII) | Audit redaction in place; extend redaction to the error sink (P5) |

## Open work (forward-looking, not yet shipped)

These block a full production sign-off but are outside what landed on this
branch:

1. Per-operator identity / IdP with MFA, replacing the shared token (P1).
2. Redis-backed, multi-instance rate limiter + edge rate limiting (P4, T3).
3. Object-storage backups with encryption + access logging (P3).
4. Wire redaction into `error-reporter.ts` before context leaves the host (P5).
5. Multisig + hardware keys for contract upgrades (P6).
6. Image-digest pinning in the deploy pipeline (P7).
7. Secondary-RPC failover (T7).
8. Independent third-party security review and contract audit.

## References

- Pilot threat model: `docs/security/threat-model-pilot.md`
- Postgres store: `lib/storage/case-store-postgres.ts`,
  `lib/storage/case-store-factory.ts`
- Env validation: `lib/config/env-validation.ts`
- Observability: `lib/observability/alerts.ts`, `app/api/health/route.ts`,
  `app/api/metrics/route.ts`, `app/api/alerts/route.ts`
- Production readiness checklist: `docs/readiness/production-readiness-checklist.md`
- Contract upgrade policy: `docs/policies/contract-upgrade-policy.md`
- Data retention policy: `docs/policies/data-retention-policy.md`
- Incident response: `docs/runbooks/incident-response.md`
