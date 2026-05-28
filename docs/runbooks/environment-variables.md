# Environment Variables Reference

Single source of truth for every env var SLAProof reads. Keep this in sync
with `.env.local.example`, `lib/config/env-validation.ts`, and the CHANGELOG
when adding new variables.

## Required

### Always

(None — the app boots in mock mode without any env vars.)

### When `NEXT_PUBLIC_SLAPROOF_VERIFIER=genlayer`

| Var | Type | Example |
|---|---|---|
| `NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS` | hex 0x + 40 chars | `0x419D67e92855B94C0BF997638963961CA0A5dBC9` |
| `NEXT_PUBLIC_GENLAYER_RPC_URL` | https URL | `https://studio.genlayer.com/api` |
| `NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL` | string | `Studionet` |
| `NEXT_PUBLIC_SLAPROOF_CHAIN_ID` | numeric | `61999` |

### Production only

| Var | Type | Notes |
|---|---|---|
| `PILOT_TOKEN` | string ≥16 chars | Required in production. Validated by middleware + login server action. |

## Optional

| Var | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SLAPROOF_VERIFIER` | `mock` | Toggle between mock and genlayer modes |
| `PORT` | `3000` | docker-compose port mapping override |
| `NEXT_TELEMETRY_DISABLED` | (Next default) | Set to `1` to disable Next.js telemetry |
| `BUILD_TIME` | `unknown` | Surfaced via `/api/version`. Inject at build time. |
| `GIT_COMMIT_SHA` / `VERCEL_GIT_COMMIT_SHA` | `unknown` | Surfaced via `/api/version`. |
| `ERROR_WEBHOOK_URL` | unset | Remote sink for `reportError()`. JSON POST to any compatible ingestion endpoint. Falls back to logger-only when unset. |
| `SENTRY_DSN` | unset | Alternative source for the remote error sink URL. |
| `SENTRY_ENVIRONMENT` | `NODE_ENV` | Override environment label sent with error payloads. |
| `SLAPROOF_RELEASE` / `NEXT_PUBLIC_SLAPROOF_COMMIT_SHA` | unset | Release/build identifier sent with error payloads. |

## Server-side only (never `NEXT_PUBLIC_*`)

| Var | Type | Used by |
|---|---|---|
| `GENLAYER_PRIVATE_KEY` | hex 0x + 64 chars | `npm run smoke:genlayer:write` only. **Never commit.** |
| `GENLAYER_PRV_KEY` / `GENLAYER_PRIVKEY` / `PRIVATE_KEY` | hex 0x + 64 chars | Aliases for the same key. First non-empty wins. |

## Validation behaviour

`lib/config/env-validation.ts` enforces:

1. Verifier mode = `genlayer` requires the four `NEXT_PUBLIC_*` vars; chain
   id must be numeric, contract must match `0x[0-9a-fA-F]{40}`, RPC must be
   `http(s)`.
2. Production requires `PILOT_TOKEN` ≥16 chars. Development logs a warning
   instead.

The instrumentation hook (`instrumentation.ts`) calls `validateEnv` at boot.
Production fails fast on errors; development logs and continues.

## Boot order

```
process start
  -> instrumentation.register()
       -> validateEnv()
            -> errors? throw in prod, warn in dev
  -> Next.js serves traffic
```

## Adding a new var

1. Add a row above with type + default.
2. Update `.env.local.example`.
3. If it's required in some mode, add a check to `validateEnv()`.
4. Add a test case in `tests/unit/env-validation.test.ts`.
5. Note it in `CHANGELOG.md` under the relevant phase.
