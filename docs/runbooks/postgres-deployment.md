# Postgres Deployment Runbook

SLAProof can persist SLA cases in a managed Postgres database (Neon, Supabase,
or self-hosted) instead of the file-backed pilot store.

## Enable Postgres mode

1. Provision a Postgres database and copy its connection string.
2. Set environment variables:
   - `SLAPROOF_STORE=postgres`
   - `DATABASE_URL=postgres://user:password@host:5432/dbname`
3. Run the migration: `npm run db:migrate`
4. Seed demo cases (only if the table is empty): `npm run db:seed`
5. Start the app. `/api/health` now includes a `database` block and returns
   503 if the database is unreachable.

## Schema

A single table, one JSONB blob per case:

| Column | Type | Notes |
|---|---|---|
| id | text | primary key (the SlaCase id) |
| data | jsonb | full SlaCase payload |
| created_at | timestamptz | set on insert; used for list ordering |
| updated_at | timestamptz | bumped on every save |

## Backups

With a hosted provider (Neon/Supabase), backups are the provider's
responsibility — enable point-in-time recovery in the provider console.

The repo's `npm run data:backup` / `data:restore` scripts operate on the
file-backed `.data/db.json` store ONLY. They do not back up Postgres. For a
self-hosted Postgres, use `pg_dump` / `pg_restore` on your own schedule.

## Rollback to file mode

Set `SLAPROOF_STORE=file` (or unset it) and restart. The app reverts to the
file-backed store. Data written to Postgres stays in Postgres; the two stores
are independent.
