# SLA Template Library

Date: 2026-05-26
Status: In implementation
Owner: ngh1105
Branch: feature/phase2-wrap-and-sla-templates

## Why

Phase 3 of the production roadmap calls for "SLA template library for RPC
providers." Current `app/cases/new/page.tsx` requires a pilot user to type
availability target, error threshold, latency threshold, exclusions, and credit
rule from scratch for every case. Pilot users have asked for guided defaults so
the demo does not depend on the operator remembering each provider's stated
terms.

## What

A small library of vendor-neutral SLA term templates that pre-populate the
intake form when an operator picks one. Templates are code only — no DB, no
remote fetch, no admin UI.

## Templates (initial set, public-doc derived)

| Template id | Provider style | Availability | Error threshold | Latency threshold |
|---|---|---|---|---|
| `rpc-99-9-monthly` | Generic premium tier | 99.9% monthly | 5% failures sustained 5 min | p95 < 1500ms |
| `rpc-99-95-monthly` | Generic enterprise tier | 99.95% monthly | 3% failures sustained 5 min | p95 < 1000ms |
| `archive-99-5-monthly` | Archive node tier | 99.5% monthly | 5% failures sustained 10 min | p95 < 3000ms |
| `custom` | Operator-defined | (blank) | (blank) | (blank) |

Templates are vendor-neutral — they describe **typical published SLA tiers**, not
any specific vendor. Operators paste the actual vendor terms when needed via the
"custom" template.

## Out of scope

- Vendor-specific named templates (legal exposure)
- Editable template store (admin UI, persistence)
- Per-case template versioning (Phase 4 concern)
- Per-team custom template uploads (multi-tenant scope)

## Architecture

```
lib/domain/sla-templates.ts          single source of truth
  ├── SlaTemplate type
  ├── slaTemplates: SlaTemplate[] const
  └── findTemplate(id): SlaTemplate | undefined

app/cases/new/page.tsx
  └── <select> in section 3 ("Promised SLA terms")
      → onChange: load template terms into state
      → "custom" preserves whatever the user already typed

tests/unit/sla-templates.test.ts     5 cases (count, ids, term shape, lookup)
tests/e2e/demo-flow.spec.ts          1 new test: pick template → fields filled
```

## Success criteria

1. Selecting a template in the new-case form populates all 5 SLA term fields.
2. "Custom" leaves existing fields untouched.
3. Templates are addressable by stable id.
4. Existing 53/53 unit tests + e2e remain green.
5. Type signatures: `SlaTemplate { id, label, description, terms: SlaTerms }`.
