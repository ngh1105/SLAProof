# Vendor Security & Contract-Audit Handoff Package

One send-ready cover/index document for an external vendor engagement. It
consolidates and cross-links the existing prep docs and threat models — it does
**not** introduce new security analysis. A vendor (or a maintainer pasting into
an RFP/email) should be able to grasp scope in under two minutes and follow the
pointers to everything else.

Built per the workflow in
[../runbooks/vendor-security-handoff.md](../runbooks/vendor-security-handoff.md).
Source of truth lives in the linked docs; this page links, it does not
duplicate.

Status legend (mirrors the readiness checklist): ✅ done · 🟡 partial · 🔴 not
started.

## 1. Project snapshot

SLAProof turns an alleged SLA breach into an auditable, on-chain **SLA breach
receipt**. An operator drafts a case (provider, SLA terms, incident window,
evidence excerpts) in a Next.js web app; the app validates and hashes the
payload, submits it to a GenLayer Intelligent Contract that evaluates the
evidence against the SLA clauses, and reads the finalized receipt back for
display and export. It produces an evidence-backed verdict
(`breach` / `no_breach` / `inconclusive` / `needs_more_evidence`), not a legal
judgment or a payout instruction.

- **Repository:** `https://github.com/ngh1105/SLAProof.git`
  (confirmed via `git remote -v`). Reviewed branch state:
  `feat/production-readiness-gate`. Grant read access to the vendor or provide
  a tagged archive of the reviewed commit.
- **Primary language / stack:** TypeScript + Next.js (App Router) for the web
  app (`app/`, `lib/`); Python for the GenLayer Intelligent Contract
  (`contracts/slaproof_rpc_verifier/`).
- **Data store:** managed **Postgres** case store
  (`SLAPROOF_STORE=postgres`, `lib/storage/case-store-postgres.ts`) as the
  app-side system of record; file store remains the local/demo default.
- **Deployment model:** Next.js app (multi-stage Dockerfile + docker-compose)
  plus the `SlaProofRpcVerifier` GenVM contract deployed on GenLayer (currently
  Studionet, chain id `61999`). The on-chain receipt — not the app store — is
  the source of truth for a verdict; read-back is required before display.

## 2. Engagement scope

The engagement splits into two clearly separated tracks. A vendor may be
scoped to one or both; they share threat models but exercise different
artifacts.

### Track A — Web / app security review

In scope (full prep:
[./external-security-review-prep.md](./external-security-review-prep.md)):

- **Authentication / session handling** — the shared `PILOT_TOKEN` cookie +
  `middleware.ts` gate, the login server action, and the planned per-operator
  identity model (P1).
- **Rate limiting** — the in-memory token-bucket limiter on case creation and
  login, including the documented login brute-force protection
  (5 attempts / 5 min). Note the per-process limitation (needs Redis-backed
  limiter for multi-instance — T3 / P1).
- **Evidence handling / redaction** — client + server credential-pattern
  scanning (12 patterns), `redactReceiptForExport`, and evidence size limits.
- **Postgres case store** — the new production attack surface: connection
  string handling, JSONB blob model, parameterized queries, pool/statement
  timeouts, and the `db:backup` / `db:restore` path.
- **CSP & security headers** — default headers, the report-only CSP, and the
  `/api/csp-report` violation sink.
- **Secrets posture / env validation** — `lib/config/env-validation.ts`,
  `instrumentation.ts`, and the server-only handling of `DATABASE_URL`,
  `PILOT_TOKEN`, `GENLAYER_PRIVATE_KEY`, and sink endpoints.
- **API endpoints, including the unauthenticated observability surface** —
  `/api/health`, `/api/metrics`, `/api/alerts`, `/api/version`, `/api/audit`,
  and the `/ops` + `/audit` pages, all reachable without the token by
  design. Specifically confirm whether `/api/audit` redaction is adequate for
  fully public exposure, and whether `/api/metrics` + `/api/alerts` should be
  rate-limited/edge-cached against monitor floods (P4).

### Track B — GenVM contract focused review / audit

In scope (full prep:
[./contract-review-prep.md](./contract-review-prep.md)):

- **Contract methods** — `submit_case(case_id, case_json)`,
  `get_receipt(case_id)`, `list_case_ids()` on `SlaProofRpcVerifier`
  (`contracts/slaproof_rpc_verifier/main.py`), plus the deterministic logic in
  `evaluator.py`.
- **Payload schema versioning** — `slaproof.case.v0` (`CASE_VERSION`) and
  `slaproof.receipt.v0` (`RECEIPT_VERSION`), version rejection on validation,
  and app-side `SUPPORTED_RECEIPT_VERSIONS` enforcement on read (P9).
- **Breach / no-breach / inconclusive logic** — the verdict resolution path
  (`validate_case` → `fallback_decision` → `decision_copy` → `build_receipt`),
  the four verdicts and their confidence values, and the deterministic
  `receipt_hash` (`receipt_digest`: sorted keys, compact separators, hash field
  blanked). Confirm determinism/idempotency across validators and probe
  handling of adversarial evidence excerpts and untrusted fetched URL content
  (carryover T4).
- **Bounds** — `MAX_EVIDENCE_ITEMS` (8), `MAX_EXCERPT_CHARS` (1200),
  `MAX_URL_CHARS` (500), unique evidence ids, and hash-mismatch rejection.

## 3. Out of scope

Drawn from the threat models and prep docs. Flag anything here that turns out
to overlap an in-scope asset, but do not treat these as deliverables:

- **Managed-provider infrastructure** — Postgres host hardening, object-storage
  backend, CDN/WAF internals. Review the app's *configuration* of these, not
  the providers themselves.
- **GenLayer protocol / network-level security** — validator consensus and RPC
  infrastructure operated by GenLayer.
- **Infrastructure that does not yet exist** — IdP, CDN/WAF, and managed DB are
  still being selected; scope these as config-review-when-built, not
  implementation review.
- **Continuous monitoring features and roadmap "Future Extensions"** not yet
  shipped (`docs/architecture/01-system-architecture.md`).
- **Cross-track items** — the contract evaluator/verdict logic is out of scope
  for Track A (it is Track B); app-side threats are out of scope for Track B.
- **Explicitly deferred in the threat models** — the forward-looking P1–P9 /
  T1–T8 open-work items (per-operator identity, Redis limiter, encrypted
  object-storage backups, error-sink redaction, multisig upgrade keys, image
  digest pinning, secondary-RPC failover). These are communicated as "planned,
  not yet built" so the reviewer scopes config review vs. implementation review
  correctly.

## 4. Pointers

Every link below resolves to a real file in the repo. Paths are relative to
this document (`docs/security/`).

| Doc | What the vendor finds there |
|---|---|
| [./external-security-review-prep.md](./external-security-review-prep.md) | Track A briefing: in/out scope, asset inventory, auth model, data flows, the unauthenticated observability endpoints, known limitations, and the access/test-command checklist. |
| [./contract-review-prep.md](./contract-review-prep.md) | Track B briefing: contract surface + public methods, payload/receipt schemas, state transitions, threat assumptions (P6, P9, T4), test-coverage summary, and deployment policy. |
| [./threat-model-production.md](./threat-model-production.md) | Production-scope threat model: trust boundaries B1–B4, STRIDE per boundary, the Postgres attack surface, the documented unauthenticated-observability decision, and the residual-risk table quoted in §5. |
| [./threat-model-pilot.md](./threat-model-pilot.md) | Pilot-scope threat model (context): the original T1–T8 threats, mitigations, and residual risks the production model carries over. |
| [../readiness/production-readiness-checklist.md](../readiness/production-readiness-checklist.md) | Overall gate status; the two 🟡 Production-Gate items this package unblocks are the external security review and the contract audit/focused review. |

## 5. Known residual risks

These are surfaced so the vendor is not surprised by what we already know. The
list below is quoted **verbatim** from the "Residual risks and mitigations"
section of [./threat-model-production.md](./threat-model-production.md) (table
rows R1–R11); each entry references an existing, shipped control. Do not treat
this as the full open-work list — the forward-looking P1–P9 / T1–T8 items live
in that same doc.

> | # | Residual risk | Mitigation (existing control) |
> |---|---|---|
> | R1 | `DATABASE_URL` leaks (logs, env dump) → full case read/write | Server-only env, no `NEXT_PUBLIC_`; `validateEnv` requires the `postgres://` form and fails boot in prod if missing/malformed |
> | R2 | SQL injection via the new store | Parameterized `$1`/`$2` queries in `list`/`get`/`save`; no string-built SQL |
> | R3 | Slow/stuck query exhausts the pool during a load spike | `connectionTimeoutMillis: 5000` + `statement_timeout: 10000` on the pool |
> | R4 | Accidental restore clobbers live production data | `db:restore` overwrite guard — refuses non-empty `cases` table without `--force` (exit 3) |
> | R5 | Secrets land in the JSONB blob on a public chain | Client + server credential scanner at B1; evidence hashed before submit (T1) |
> | R6 | Public observability surface aids recon / DoS timing | Accepted decision (above); `/api/health` edge-cached + CDN/WAF (P4); endpoints expose no secrets/PII |
> | R7 | DB unreachable serves stale/wrong "ok" | `/api/health` runs a DB ping and returns **503** when it fails; verifier-not-ready also 503 |
> | R8 | Shared `PILOT_TOKEN` gives no per-person attribution | Token checked on every write + audit log; per-operator identity tracked as the top open item (P1) |
> | R9 | Error context shipped to external sink leaks PII | Audit redaction exists; extend the same redaction into `error-reporter.ts` before it leaves the host (open, P5) |
> | R10 | RPC outage stalls writes with no failover | 503 health gating + operator `mock` fallback (T7); automatic secondary RPC still open |
> | R11 | Contract upgrade key compromise → malicious contract at a trusted-looking address | Address pinned per env + `validateEnv` hex check; append-only address registry; multisig + hardware keys (open, P6) |

For the accepted-risk rationale on the unauthenticated observability surface
(R6), see the "Public observability / alerting surface (documented decision)"
section of [./threat-model-production.md](./threat-model-production.md), which
records why no auth is added and why gating only one of `/api/metrics` /
`/api/alerts` would be incoherent.

## 6. What we expect back

Deliverable expectations for either track:

- **Findings list with severity.** Each finding as its own entry with a
  severity rating, a clear title, and affected component/file.
- **Reproduction.** Concrete reproduction steps (request, payload, or state)
  sufficient for a maintainer to reproduce without further discovery. The app
  stands up locally from the documented commands (`npm install`,
  `npm run dev` for mock mode, `npm run build`); contract tests run via
  `npm run test:contract`.
- **Remediation.** A recommended fix or mitigation per finding, plus any
  interim/compensating control where a full fix is non-trivial.
- **CWE / severity mapping.** Map each finding to a **CWE** identifier and a
  severity scheme (CVSS or an agreed qualitative scale) so we can triage and
  track consistently.
- **Disposition of our self-identified items.** For the residual risks in §5
  and the known limitations in the prep docs, confirm / challenge /
  de-prioritize rather than re-discover.
- **Track B specifics.** Confirm `receipt_digest` determinism across
  validators, re-submit (overwrite vs. append) semantics for a repeated
  `case_id`, and how the contract handles adversarial excerpts / untrusted
  fetched URL content. Run the full `genvm-lint check` in a clean GenVM
  environment (a local SDK-download gap currently limits us to AST lint +
  pytest + py_compile).

Route findings through the disclosure channel in `SECURITY.md`. Share findings
that reference secrets by key name, never by value.

## 7. Contacts

Placeholders only — fill before sending. Do **not** commit real names, emails,
or PII into this file.

- **Security contact:** `<FILL>` (disclosure channel of record is `SECURITY.md`
  and `/.well-known/security.txt`)
- **Engineering owner:** `<FILL>`
- **Incident response:** `<FILL>` (named contact lives in
  `../runbooks/incident-response.md`)

---

Status: prepared, awaiting vendor. This package links to source-of-truth docs;
when those change, re-check the pointers in §4 rather than editing copied
content here.
