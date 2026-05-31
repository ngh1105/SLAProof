# Vendor Security & Contract-Audit Handoff Workflow

Repeatable process for packaging SLAProof for an **external security review** and
an **external contract audit**. These are the remaining 🟡 items on the
production gate that are blocked only on engaging an outside vendor — this
workflow turns the existing prep docs into a single send-ready handoff bundle.

Status legend mirrors the readiness checklist: ✅ done · 🟡 partial · 🔴 not started.

## Goal

Produce `docs/security/vendor-handoff-package.md`: one cover/index document a
vendor can be handed (or a maintainer can paste into an RFP/email) that points
to everything they need, states scope, and lists what we expect back. No new
security analysis is invented — it consolidates and cross-links what already
exists.

## Inputs (source of truth — do not duplicate, link)

| Doc | Purpose |
|---|---|
| `docs/security/external-security-review-prep.md` | App/web security review prep |
| `docs/security/contract-review-prep.md` | GenVM contract audit prep |
| `docs/security/threat-model-production.md` | Production-scope threat model + residual risks |
| `docs/security/threat-model-pilot.md` | Pilot-scope threat model (context) |
| `docs/readiness/production-readiness-checklist.md` | Overall gate status |

## Output

`docs/security/vendor-handoff-package.md` containing, in order:

1. **Project snapshot** — what SLAProof is (one paragraph), repo URL, primary
   language/stack, deployment model (Next.js app + GenVM contract on GenLayer).
2. **Engagement scope** — two tracks clearly separated:
   - Track A: web/app security review (in scope: auth, rate limiting, evidence
     handling, CSP, secrets posture, API endpoints incl. the unauthenticated
     `/api/metrics` + `/api/alerts`).
   - Track B: GenVM contract focused review/audit (contract methods, payload
     schema versioning, breach/no-breach/inconclusive logic).
3. **Out of scope** — managed-provider infra, third-party RPC availability,
   anything explicitly deferred in the threat model.
4. **Pointers** — table linking each prep doc + threat model with a one-line
   summary of what the vendor will find there.
5. **Known residual risks** — pull the residual-risk list from the production
   threat model verbatim (cite the source doc) so the vendor isn't surprised.
6. **What we expect back** — deliverable format (findings with severity,
   reproduction, remediation), and a request to map findings to CWE/severity.
7. **Contacts** — placeholders only: `Security contact: <FILL>`,
   `Engineering owner: <FILL>`, `Incident response: <FILL>`. Do NOT invent
   names, emails, or real PII — leave bracketed placeholders.

## Workflow steps (subagent follows these)

1. Read all five input docs in full. Read-only — do not edit any source doc.
2. Confirm the repo URL from `git remote -v` (do not hardcode from memory).
3. Build `docs/security/vendor-handoff-package.md` per the Output structure
   above. Cross-link with relative paths (e.g. `./threat-model-production.md`).
4. For residual risks, quote the actual entries from
   `threat-model-production.md` rather than paraphrasing; cite the section.
5. Use bracketed `<FILL>` placeholders for every contact/PII field.
6. Add a one-line entry to `CHANGELOG.md` under an Unreleased/working section if
   that file uses one; otherwise skip (don't restructure the changelog).
7. Verify nothing else broke: `npm run typecheck` and `npm run lint` must stay
   clean (this is a docs-only change, so they should be unaffected — confirm,
   don't assume).
8. Do NOT commit or push. Leave the change staged-or-unstaged for the main
   session to review and fold into PR #99 or a follow-up.

## Constraints

- Docs-only. No code changes, no new dependencies.
- No invented findings, names, emails, dates, or contract addresses — link to
  source docs and use placeholders.
- Keep the package skimmable: a vendor should grasp scope in under 2 minutes.
- Per-write limit: build the output in chunks (≤300 lines per write/append).

## Done criteria

- `docs/security/vendor-handoff-package.md` exists and covers all 7 sections.
- Every external link resolves to a real file in the repo.
- typecheck + lint still clean.
- No secrets or invented PII introduced.
