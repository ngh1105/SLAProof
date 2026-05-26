# Contributing

Thanks for your interest. SLAProof is a single-maintainer pilot project; the
guidance below describes the workflow used for the work merged to master.

## Local setup

```bash
npm install
cp .env.local.example .env.local   # adjust as needed
npm run dev
```

Default verifier is `mock` — no wallet or chain access required to run the
demo.

## Development workflow

1. Create a feature branch from `master`:

   ```bash
   git checkout master && git pull
   git checkout -b feature/<short-description>
   ```

2. Write a failing test before implementation when changing behavior:

   ```bash
   npx vitest run tests/unit/<file>.test.ts
   ```

3. Run the local quality gate before committing:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

4. Commit messages follow conventional-style prefixes:

   - `feat(scope): ...` new behavior or capability
   - `fix(scope): ...` bug fix
   - `docs(scope): ...` documentation only
   - `chore(scope): ...` repo housekeeping
   - `ci(scope): ...` build / CI changes
   - `test(scope): ...` tests only

5. Push and open a PR. CI runs lint, typecheck, unit tests, build, e2e, npm
   audit, and Python contract tests. Wait for green before merging.

6. Squash-merge into master. Delete the branch after merge.

## Code style

- TypeScript strict mode is on. No `any` without comment.
- Prefer pure functions in `lib/`. Side effects belong in `app/` server
  actions or `scripts/`.
- File-level comment is fine for non-obvious modules; otherwise let names
  carry the meaning.
- New features should ship with a unit test. Aim for 80%+ coverage on new
  files.
- Don't add a dependency for something a 30-line helper could do.

## Test discipline

- Unit tests in `tests/unit/` use Vitest.
- E2E tests in `tests/e2e/` use Playwright with the mock verifier; wallet
  flows are covered manually (see the QA checklist in the live MVP design
  spec).
- Contract tests in `contracts/slaproof_rpc_verifier/` run with pytest.

## Security

If you find a vulnerability, follow `SECURITY.md` rather than opening a
public issue.

## Documentation

Significant features need:

- A spec under `docs/superpowers/specs/<date>-<topic>-design.md`
- A plan under `docs/superpowers/plans/<date>-<topic>.md` for multi-task work
- An entry in `CHANGELOG.md`

Operational changes need a runbook entry in `docs/runbooks/`.

## Phases

The project follows a phased roadmap (`docs/plans/02-production-roadmap.md`).
Pull requests should call out which phase deliverable they advance so reviewers
can match scope to context.
