# Docker Deployment Runbook

This runbook covers deploying SLAProof via the Docker image and compose
file shipped in PRs #71 and #72.

## Prerequisites

- Docker 25.x or later
- Docker Compose v2 (bundled with recent Docker Desktop / `docker compose`)
- A copy of `.env` populated from `.env.local.example`

## First-time deploy

```bash
git clone https://github.com/ngh1105/SLAProof.git
cd SLAProof
cp .env.local.example .env
# edit .env: set PILOT_TOKEN, NEXT_PUBLIC_SLAPROOF_VERIFIER, etc.
docker compose up -d --build
```

Visit `http://<host>:3000`. The container exposes `/api/health` on port 3000;
compose-level healthcheck polls every 30s.

## Updates

```bash
git pull
docker compose up -d --build
```

The named volume `slaproof-data` persists `.data/db.json` and
`.data/audit.log.jsonl` across rebuilds. Backups produced by
`npm run data:backup` go into the same volume.

## Inspect

```bash
docker compose logs -f app             # tail logs
docker compose exec app cat .data/audit.log.jsonl
curl http://localhost:3000/api/health  # readiness
curl http://localhost:3000/api/metrics # counters + histograms
curl http://localhost:3000/api/version # build info
```

## Rotate the audit log

```bash
docker compose exec app npm run audit:rotate
# or force rotation
docker compose exec app npm run audit:rotate -- --force
```

## Backup + restore

```bash
docker compose exec app npm run data:backup -- --keep 7
docker compose exec app npm run data:restore -- .data/backups/<file>
```

For off-host backups, copy the volume to local disk:

```bash
docker run --rm -v slaproof_slaproof-data:/data -v "$PWD":/out alpine \
  tar -czf /out/slaproof-data-$(date +%F).tgz -C /data .
```

## Rollback

If a build is bad:

```bash
git checkout <previous-good-sha>
docker compose up -d --build
```

If the data is bad but the build is good:

```bash
docker compose down
# inspect the volume, restore from backup tarball, bring it back up
docker compose up -d
```

## Switch between mock and live mode

Edit `.env`:

- `NEXT_PUBLIC_SLAPROOF_VERIFIER=mock` — offline demo, no chain access
- `NEXT_PUBLIC_SLAPROOF_VERIFIER=genlayer` — live Studionet (requires
  contract address + RPC URL + chain id from `.env.local.example`)

Then `docker compose up -d` (no rebuild needed for env-only changes).

## Production caveats

- Single-node deploy. Multi-instance pilots need: Redis-backed rate
  limiter, managed Postgres for `db.json`, shared blob storage for the
  audit log, and a real load balancer in front.
- The container image runs as `nextjs` (UID 1001). Pin the volume mount
  permissions accordingly if you bind-mount instead of using the named
  volume.
- HSTS is set in production via `next.config.ts`. Make sure your TLS
  termination is solid before pointing real users at the host.

## References

- Dockerfile: `Dockerfile`
- Compose: `docker-compose.yml`
- Incident response: `docs/runbooks/incident-response.md`
- Data retention: `docs/policies/data-retention-policy.md`
