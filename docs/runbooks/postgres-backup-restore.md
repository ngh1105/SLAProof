# Postgres Backup And Restore Runbook

SLAProof supports app-level logical backups for the Postgres-backed `cases`
store. These snapshots are separate from provider-managed physical backups.

## Scope

- `npm run db:backup` exports every `SlaCase` from the active Postgres
  `CaseStore` into `.data/pg-backups/slaproof-pg-<timestamp>.json`.
- `npm run db:restore -- <snapshot.json>` replays a snapshot through
  `CaseStore.save()`.
- The scripts are enabled only when `SLAPROOF_STORE=postgres`.
- Physical backups, PITR, failover, and storage encryption remain the managed
  database provider's responsibility.

The older `npm run data:backup` and `npm run data:restore` commands are only for
file-store pilot data (`.data/db.json`). Do not use them for Postgres.

## Deploy / Migration Order

For a new managed database:

1. Provision the hosted Postgres database.
2. Set `SLAPROOF_STORE=postgres` and `DATABASE_URL` in the runtime environment.
3. Run `npm run db:migrate` to create the `cases` table.
4. Optionally run `npm run db:seed` to insert demo cases when the table is empty.
5. Start or redeploy the app.
6. Confirm `/api/health` returns `database.checked: true` and `database.ok: true`.

For schema changes, run migrations before sending traffic to code that depends
on the new schema. Current migrations are idempotent and live in
`lib/storage/migrations/`.

## Backup

Run a one-off logical backup:

```bash
SLAPROOF_STORE=postgres DATABASE_URL="postgres://..." npm run db:backup
```

Expected output:

```text
Backup written: <repo>/.data/pg-backups/slaproof-pg-YYYY-MM-DDTHH-MM-SSZ.json (N case(s))
```

Rotate old snapshots by keeping only the newest `N` files:

```bash
SLAPROOF_STORE=postgres DATABASE_URL="postgres://..." npm run db:backup -- --keep 7
```

`--keep` must be a positive integer. Invalid values exit with code `2`.

If `SLAPROOF_STORE` is unset or set to `file`, `db:backup` exits `0` and prints a
skip message. This makes it safe to wire into generic operational scripts.

## Restore

Restore into an empty Postgres case table:

```bash
SLAPROOF_STORE=postgres DATABASE_URL="postgres://..." npm run db:restore -- .data/pg-backups/slaproof-pg-YYYY-MM-DDTHH-MM-SSZ.json
```

The script refuses to restore into a non-empty table unless `--force` is set:

```bash
SLAPROOF_STORE=postgres DATABASE_URL="postgres://..." npm run db:restore -- .data/pg-backups/slaproof-pg-YYYY-MM-DDTHH-MM-SSZ.json --force
```

Exit codes:

| Code | Meaning |
|---:|---|
| 0 | Restore completed. |
| 1 | Unexpected runtime error or `SLAPROOF_STORE` is not `postgres`. |
| 2 | Missing snapshot path. |
| 3 | Non-empty table blocked restore without `--force`. |

> **Restore is not atomic.** Rows are replayed one at a time through
> `CaseStore.save()`; the store interface exposes no multi-statement
> transaction. If a restore fails partway through (especially after a `--force`
> overwrite) the table can be left partially restored. Prefer restoring into an
> empty table. If a `--force` restore fails mid-run, re-run it against the same
> snapshot to converge (saves are idempotent upserts keyed by case `id`).

## Managed Provider Backups

Logical snapshots are useful for app-level portability and rehearsed restores,
but they are not a substitute for managed Postgres backup features. For a real
pilot or production deployment:

- Enable provider point-in-time recovery (PITR) where available.
- Confirm retention duration and restore-time objective with the provider.
- Run provider-native restore drills before onboarding real pilot data.
- For self-hosted Postgres, schedule `pg_dump` / `pg_restore` or physical WAL
  archiving separately from these app-level scripts.

## Restore Drill Checklist

1. Create a disposable database.
2. Run `npm run db:migrate` against it.
3. Restore the latest logical snapshot.
4. Start the app with the disposable database connection string.
5. Confirm case list, case detail pages, and receipt pages load.
6. Confirm `/api/health` reports database OK.
7. Delete the disposable database.
