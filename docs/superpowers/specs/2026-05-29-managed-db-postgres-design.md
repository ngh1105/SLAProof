# Managed Database Migration (Postgres)

Date: 2026-05-29
Status: Approved, ready for planning
Owner: ngh1105

## Why

The production readiness checklist lists managed persistence as the last
remaining gap on the Pilot Gate. Today SLA cases live in a file-backed JSON
store (`.data/db.json`) with a hand-rolled file lock. That is fine for a single
container but blocks a credible pilot: no concurrent-safe networked store, no
managed backups, no horizontal scaling.

This work swaps the file store for hosted Postgres (Neon or Supabase) behind the
existing `CaseStore` interface, without changing product behavior.

## What

Add a Postgres-backed `CaseStore` implementation selectable by environment
variable, while keeping the file store as the default so the current pilot does
not break. The case payload is stored as a single JSONB blob per row — a direct
mirror of the file store shape.

## Decisions (locked during brainstorming)

- **Database:** Hosted Postgres (Neon/Supabase). No DB container added to
  docker-compose; backups are the provider's responsibility.
- **Data model:** JSONB blob, one row per case. No normalization of evidence.
- **Driver:** Raw `pg` (node-postgres). No ORM, no vendor SDK. Vendor-neutral —
  swap connection string to move between providers.
- **Interface:** `CaseStore` becomes async. This is the unavoidable consequence
  of a networked store and was anticipated in the interface comment.

## Out of scope

- Normalized relational schema (evidence as separate table) — YAGNI for
  list/get/upsert.
- ORM adoption (Prisma/Drizzle).
- Vendor SDK lock-in (Supabase JS, Neon serverless driver).
- Local Postgres container for development — documented as optional, not built.
- Rewriting `data:backup` / `data:restore` for Postgres — those become
  file-store-only; managed provider handles Postgres backups.
- Query-by-field, pagination, or filtering at the storage layer.

## Architecture

Mirror the existing verifier factory pattern (`lib/verifier/index.ts`) for
storage selection.

```
lib/storage/
  case-store-interface.ts     CaseStore (now async)
  case-store-file.ts          renamed from case-store.ts; file store (async wrap)
  case-store-memory.ts        async wrap (used by unit tests)
  case-store-postgres.ts      NEW: pg.Pool singleton + 3 SQL statements
  case-store-factory.ts       NEW: select store by env
  migrations/001_init.sql     NEW: schema
  seed.ts                     NEW: seed 4 demo cases, idempotent

lib/domain/fixtures.ts        async re-export via factory
scripts/migrate.mjs           NEW: run migrations
scripts/seed.mjs              NEW: seed only when table is empty
```

### Store selection (server-only env)

- `SLAPROOF_STORE` = `file` | `postgres` (default `file`).
- `DATABASE_URL` = connection string (required when `SLAPROOF_STORE=postgres`).

These are NOT `NEXT_PUBLIC_` — they must never reach the client bundle.

## Interface (async)

```typescript
export interface CaseStore {
  list(): Promise<SlaCase[]>;
  get(caseId: string): Promise<SlaCase | undefined>;
  save(slaCase: SlaCase): Promise<void>;
}
```

File and memory stores wrap their existing synchronous logic in `async`. The
Postgres store uses a module-level `pg.Pool` singleton to avoid exhausting
connections under serverless or repeated invocation.

## Schema

```sql
create table if not exists cases (
  id          text primary key,
  data        jsonb        not null,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);
```

### SQL operations

- `list`: `SELECT data FROM cases ORDER BY created_at`
- `get`: `SELECT data FROM cases WHERE id = $1`
- `save`: `INSERT INTO cases (id, data) VALUES ($1, $2)
   ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = now()`

`save` derives `created_at` from the row default on first insert; subsequent
saves only touch `data` and `updated_at`. The `SlaCase.createdAt` /
`updatedAt` fields inside the JSONB blob remain the application source of truth
for display; the SQL columns exist for ordering and operational queries.

## Call sites affected (await propagation)

| File | Kind | Change |
|---|---|---|
| `app/cases/[caseId]/page.tsx` | Server Component | `await getDemoCase()` |
| `app/receipt/[caseId]/page.tsx` | Server Component | `await getDemoCase()` |
| `app/cases/new/actions.ts` | Server Action (async) | `await saveDemoCase()` |
| `lib/export/receipt-export.ts` | helper | becomes async; caller awaits |
| `lib/verifier/mock-adapter.ts` | adapter | `await getDemoCase()` |
| `lib/domain/fixtures.ts` | re-export | async wrappers |
| unit tests | test | `await` + in-memory store |

All consumers are Server Components (async-friendly) or Server Actions (already
async). No React Client Component is affected.

## Error handling and health

- Postgres errors are wrapped through the existing `reportError` abstraction
  with a phase tag (e.g., `phase: "pgCaseStore.save"`).
- `/api/health` adds a DB ping (`SELECT 1`) when `SLAPROOF_STORE=postgres`,
  returning 503 if the database is unreachable.
- `env-validation.ts` adds a rule: when `SLAPROOF_STORE=postgres`, `DATABASE_URL`
  is required and must match `^postgres(ql)?://`.

## Migration, seed, docker, backup

- `scripts/migrate.mjs` runs `001_init.sql` (idempotent via `if not exists`).
- `scripts/seed.mjs` inserts the 4 demo cases only when the table is empty, so
  it never clobbers pilot data.
- `package.json` gains `db:migrate` and `db:seed` scripts.
- Docker: no new service. `.env.local.example` and a runbook document
  `DATABASE_URL` and the migrate/seed steps.
- `data:backup` / `data:restore` are relabeled file-store-only in their runbook;
  Postgres backups are the managed provider's responsibility.

## Testing

- Unit tests switch to `await` and use `createInMemoryCaseStore` for isolation.
- Postgres adapter gets one integration test guarded by `TEST_DATABASE_URL`:
  skipped when the variable is absent, so CI does not require Postgres.
- E2E Playwright runs against the default `file` store — unchanged.

## Success criteria

1. With `SLAPROOF_STORE=file` (default), behavior is identical to today; all
   existing unit + e2e tests pass.
2. With `SLAPROOF_STORE=postgres` and a valid `DATABASE_URL`, the app reads,
   creates, and updates cases against Postgres.
3. `npm run db:migrate` creates the schema; `npm run db:seed` loads demo cases
   only into an empty table.
4. `/api/health` reports DB connectivity in Postgres mode.
5. `env-validation` fails fast in production when `DATABASE_URL` is missing or
   malformed in Postgres mode.
6. The Postgres adapter is covered by an env-guarded integration test.
7. No `NEXT_PUBLIC_` exposure of `DATABASE_URL`.
