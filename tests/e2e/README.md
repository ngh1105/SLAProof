# E2E Tests

Playwright smoke runs against the **mock verifier** only.

Browser wallet flows (connect, switch chain, sign tx) are not automated. They
are covered in the manual QA checklist in
`docs/superpowers/specs/2026-05-25-genlayer-live-mvp-design.md`.

Run:

```bash
npm run test:e2e
```
