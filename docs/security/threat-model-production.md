# SLAProof Threat Model (Production)

Date: 2026-05-27
Status: Draft scoping document. Production-grade modeling needs an external
review pass before depending on this for the production gate.

## How this differs from the pilot model

`threat-model-pilot.md` covers the single-host single-operator pilot.
Production assumes:

- Multiple operator identities (not one shared `PILOT_TOKEN`)
- Managed database (Postgres) replacing the file store
- Managed object storage for backups
- A real CDN / load balancer in front of Next.js
- External error tracker + log aggregator
- Public traffic, including unauthenticated browsers and bots

The pilot threats T1-T8 still apply; their mitigations need stronger
implementations under production assumptions.

## New in-scope assets

| Asset | Where | Sensitivity |
|---|---|---|
| Operator identities | external IdP (TBD) | High — controls write access |
| Operator session | cookie + IdP session | High |
| Postgres database | managed service | **Critical** — replaces file store |
| Backup snapshots | object storage | **Critical** — restore source |
| Log aggregator data | external SaaS | Medium |
| Error tracker data | external SaaS | Medium — may capture exception context |
| CDN / proxy logs | provider-controlled | Medium — request metadata |
| TLS certificates | proxy / CDN | High — rotation path matters |
| Contract upgrade keys | wallet / multisig | **Critical** — controls deployment |

## Production-only threats

### P1 — Operator account takeover
**Vector:** Phishing, credential stuffing, or stolen IdP session lets an
attacker log in as a real operator and submit / view cases.

**Mitigation (required):**
- IdP with MFA enforced (TBD: Okta / WorkOS / GitHub Enterprise SSO)
- Per-operator audit identity (replace pilot's single-actor "pilot" string)
- Session revocation path documented in incident runbook
- Per-operator rate limits (Redis-backed; current in-memory limiter is
  per-process)
- Anomaly logging — repeated submits from new IPs, rapid case creation

**Open:** which IdP. Decision blocks production gate.

### P2 — SQL injection / Postgres misuse
**Vector:** Hand-rolled SQL paths in the new managed-DB adapter introduce
parameter injection.

**Mitigation:**
- Use a typed query builder (drizzle / kysely) — avoid raw template strings
- Schema migrations reviewed; enforced via `prisma migrate` or equivalent
- Postgres role with least-privilege CRUD on app tables only
- Read replica for `/api/audit` + read-heavy paths

**Open:** ORM choice. Currently zero SQL surface; new adapter must ship
with this gate.

### P3 — Backup exfiltration
**Vector:** Object-storage bucket misconfigured (public ACL, leaked
credential) lets attacker download all case JSON + audit log.

**Mitigation:**
- Bucket policy: deny public, require IAM auth
- Server-side encryption (AES-256 / KMS-managed key)
- Access logged to a separate bucket
- Quarterly key rotation
- Lifecycle policy: glacier-tier old backups, delete >365 days per data
  retention policy

### P4 — DDoS / resource exhaustion
**Vector:** Flood `/cases/new` POSTs, `/api/health`, or expensive routes.

**Mitigation:**
- CDN absorbs cacheable traffic
- WAF rules for `/api/csp-report` and `/login` floods
- Rate limit at edge (CDN) AND app (current limiter)
- `/api/health` cached for 5s at the edge to absorb monitor floods
- Long-running operations (verifier read-after-write) timed out at the proxy

### P5 — Log / error tracker leaks PII
**Vector:** Error context shipped via `reportError` includes sensitive
fields, lands in an external SaaS where it can't be deleted.

**Mitigation:**
- Apply same redaction as audit log (`redactDetails`) inside `error-reporter.ts`
  before sending. Currently audit redacts but error-reporter does not.
- Limit context fields to an allowlist (caseId, txHash, code, phase, digest)
- Document scrubbing policy with the chosen provider (Sentry data scrubbers,
  Datadog sensitive data scanner)

**Open:** wire redaction into `error-reporter.ts`. Tracking item.

### P6 — Contract upgrade key compromise
**Vector:** The wallet / multisig that can deploy a new contract is
phished or its private key leaks. Attacker deploys a malicious contract
at a "looks legitimate" address.

**Mitigation:**
- Multisig (e.g., Safe) — never a single hot wallet
- Hardware key for signers
- Address registry append-only (already in `genlayer-deployment.md`); any
  new entry requires PR review with attached deploy tx hash
- App pins contract address per environment (env var + `validateEnv`); a
  silent address swap requires both the env change and a deploy

### P7 — Supply chain compromise
**Vector:** Malicious version of `genlayer-js`, `next`, or a transitive
dep ships in CI build.

**Mitigation:**
- `npm audit --omit=dev --audit-level=high` already in CI
- CodeQL workflow already in repo (manual + cron)
- Dependabot grouped weekly updates
- Lock to npm registry only; no git/tarball deps
- Consider `npm install --ignore-scripts` for lifecycle-script protection
- Production deploy uses pinned image digest, not tag

**Open:** image digest pinning in deployment pipeline.

### P8 — Cross-tenant data leak (when multi-tenant ships)
**Vector:** Multi-operator Postgres schema has shared tables; a query
forgets a tenant filter and returns another tenant's data.

**Mitigation:**
- Row-level security (Postgres RLS) keyed on tenant id
- Dedicated read role per tenant (alternative)
- Test fixture asserts every list query includes the tenant filter

**Open:** out of scope until multi-tenant is on the roadmap.

### P9 — Receipt schema collision
**Vector:** A future `slaproof.receipt.v1` ships alongside v0; UI receipt
page renders both incorrectly.

**Mitigation:**
- `SUPPORTED_RECEIPT_VERSIONS` already enforced (PR #14)
- Add per-version renderer: each supported version maps to a dedicated
  React component
- Receipt API returns explicit version field; UI never assumes shape

## Carryovers (re-evaluate under production)

| Pilot ID | Production note |
|---|---|
| T1 (credential leak) | Server-side scanner + audit redaction stay; consider also pre-hashing client-side to avoid raw paste in the network path |
| T2 (stolen pilot token) | Replaced by P1 — per-operator identity |
| T3 (rate-limit bypass) | Move to Redis-backed limiter for multi-instance |
| T4 (malicious payload) | Same; LLM prompt-injection guidance still applies |
| T5 (storage corruption) | Replaced by P2 / P3 — managed DB + backup |
| T6 (contract schema break) | P9 + contract upgrade policy |
| T7 (RPC outage) | Add secondary RPC failover; not yet implemented |
| T8 (audit PII) | Redaction implemented (PR #75); P5 extends to error tracker |

## External review checklist (pre-production-gate)

- [ ] Independent security review by a third party
- [ ] Threat model walkthrough with the chosen IdP integrator
- [ ] Penetration test of `/login`, `/cases/new`, `/api/*`
- [ ] Contract audit (focused review of evaluator + verdict logic)
- [ ] Tabletop exercise on each P-threat above
- [ ] Confirm SECURITY.md and SLAs match the pilot operator agreements

## Open work

Tracked items that block the production gate:

1. Redact context in `error-reporter.ts` (P5).
2. Pick + integrate IdP (P1).
3. Pick + integrate ORM, ship Postgres adapter against `CaseStore` interface (P2).
4. Pick + integrate object-storage backup (P3).
5. Set up multisig + hardware keys for contract upgrades (P6).
6. Wire image-digest pinning in deployment pipeline (P7).
7. Independent security review.
8. Independent contract audit.

## References

- Pilot threat model: `docs/security/threat-model-pilot.md`
- Production readiness checklist: `docs/readiness/production-readiness-checklist.md`
- Contract upgrade policy: `docs/policies/contract-upgrade-policy.md`
- Data retention policy: `docs/policies/data-retention-policy.md`
- Incident response: `docs/runbooks/incident-response.md`
