# Managed Database Migration (Postgres) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Postgres-backed `CaseStore` (selectable by env) behind an async storage interface, while keeping the file store as the default so the current pilot keeps working.

**Architecture:** Flip the `CaseStore` interface from synchronous to async (the unavoidable consequence of a networked store, already anticipated in the interface comment). Add a `pg`-based store that keeps each case as a single JSONB blob, mirroring the file store's shape. A factory selects file vs postgres via `SLAPROOF_STORE`. The sync seed/test helpers in `case-store.ts` stay as-is so tests that only need seeded fixtures do not change.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), TypeScript, `pg` (node-postgres), Vitest, Postgres (Neon/Supabase hosted).

**Spec:** `docs/superpowers/specs/2026-05-29-managed-db-postgres-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lib/storage/case-store-interface.ts` | `CaseStore` contract | Modify — make async |
| `lib/storage/case-store.ts` | File store + sync seed/test helpers + async `fileCaseStore` | Modify — async adapter |
| `lib/storage/case-store-memory.ts` | In-memory store for tests | Modify — make async |
| `lib/storage/case-store-postgres.ts` | Postgres store (pool + 3 SQL ops) | Create |
| `lib/storage/case-store-factory.ts` | Select store by env | Create |
| `lib/storage/migrations/001_init.sql` | Schema | Create |
| `lib/storage/seed.ts` | Idempotent demo-case seed | Create |
| `lib/domain/fixtures.ts` | Async façade over the configured store | Modify — async |
| `lib/config/env-validation.ts` | Require `DATABASE_URL` in postgres mode | Modify |
| `lib/verifier/mock-adapter.ts` | `getReceipt` reads via async store | Modify |
| `lib/export/receipt-export.ts` | Markdown export reads case title via async store | Modify |
| `app/cases/[caseId]/page.tsx` | Case detail page | Modify — await |
| `app/receipt/[caseId]/page.tsx` | Receipt page | Modify — await |
| `app/cases/new/actions.ts` | Create-case Server Action | Modify — await |
| `app/api/health/route.ts` | Health probe + DB ping | Modify |
| `scripts/migrate.mjs` | Run migration SQL | Create |
| `scripts/seed.mjs` | Seed only when table empty | Create |
| `package.json` | `db:migrate`, `db:seed` scripts + `pg` dep | Modify |
| `.env.local.example` | Document `SLAPROOF_STORE`, `DATABASE_URL` | Modify |
| `docs/runbooks/postgres-deployment.md` | Migrate/seed/backup runbook | Create |
| Tests | Adapt to async + add Postgres integration test | Modify/Create |

---

## Task 1: Add the `pg` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install pg and its types**

Run:
```bash
npm install pg@^8.13.1 && npm install --save-dev @types/pg@^8.11.10
```
Expected: `package.json` gains `pg` under `dependencies` and `@types/pg` under `devDependencies`; `package-lock.json` updates; no audit errors at `high` level.

- [ ] **Step 2: Verify the build still passes**

Run: `npm run typecheck`
Expected: PASS (no type errors — nothing imports `pg` yet).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add pg (node-postgres) dependency"
```

---

## Task 2: Flip the CaseStore interface and all consumers to async

This is one cohesive refactor committed together so the build stays green. The behavior is unchanged: the default store is still the file store. Every consumer learns to `await`.

**Files:**
- Modify: `lib/storage/case-store-interface.ts`
- Modify: `lib/storage/case-store.ts:268-279`
- Modify: `lib/storage/case-store-memory.ts`
- Modify: `lib/domain/fixtures.ts`
- Modify: `lib/verifier/mock-adapter.ts:24-27`
- Modify: `lib/export/receipt-export.ts`
- Modify: `app/cases/[caseId]/page.tsx:16,27`
- Modify: `app/receipt/[caseId]/page.tsx:17,37`
- Modify: `app/cases/new/actions.ts:56`
- Test: `tests/unit/case-store-memory.test.ts`
- Test: `tests/unit/mock-adapter.test.ts`
- Test: `tests/unit/domain.test.ts`

- [ ] **Step 1: Update the memory-store test to expect async (failing test)**

Replace the body of `tests/unit/case-store-memory.test.ts` describe block so every store call awaits:

```typescript
describe("createInMemoryCaseStore", () => {
  it("starts empty by default", async () => {
    const store = createInMemoryCaseStore();
    expect(await store.list()).toEqual([]);
    expect(await store.get("missing")).toBeUndefined();
  });

  it("seeds initial cases", async () => {
    const store = createInMemoryCaseStore([sample]);
    expect(await store.list()).toHaveLength(1);
    expect((await store.get(sample.id))?.title).toBe("Test case");
  });

  it("save inserts new case", async () => {
    const store = createInMemoryCaseStore();
    await store.save(sample);
    expect(await store.list()).toHaveLength(1);
    expect(await store.get(sample.id)).toBeDefined();
  });

  it("save updates existing case", async () => {
    const store = createInMemoryCaseStore([sample]);
    await store.save({ ...sample, title: "Updated" });
    expect(await store.list()).toHaveLength(1);
    expect((await store.get(sample.id))?.title).toBe("Updated");
  });
});
```

- [ ] **Step 2: Run the memory-store test to verify it fails**

Run: `npx vitest run tests/unit/case-store-memory.test.ts`
Expected: FAIL — `await store.list()` resolves to a non-thenable array today, so `toHaveLength` on a Promise or type errors surface. (If it accidentally passes, the interface is still sync — continue to flip it.)

- [ ] **Step 3: Make the interface async**

Replace `lib/storage/case-store-interface.ts` with:

```typescript
import type { SlaCase } from "@/lib/domain/types";

/**
 * Case store interface. Abstracts persistence so the file-backed pilot
 * implementation can be swapped for a managed database in production
 * without touching callers.
 *
 * Methods are async: a networked store (Postgres) cannot satisfy a
 * synchronous contract. The file and in-memory stores wrap their
 * synchronous logic in resolved promises.
 */
export interface CaseStore {
  list(): Promise<SlaCase[]>;
  get(caseId: string): Promise<SlaCase | undefined>;
  save(slaCase: SlaCase): Promise<void>;
}
```

- [ ] **Step 4: Make the in-memory store async**

Replace `lib/storage/case-store-memory.ts` with:

```typescript
import type { SlaCase } from "@/lib/domain/types";
import type { CaseStore } from "./case-store-interface";

/**
 * In-memory CaseStore — useful for unit tests that need isolation from the
 * file-backed store, and as a reference implementation when adding new
 * backends (e.g., Postgres).
 */
export function createInMemoryCaseStore(seed: SlaCase[] = []): CaseStore {
  const cases = new Map<string, SlaCase>();
  for (const c of seed) cases.set(c.id, c);

  return {
    async list(): Promise<SlaCase[]> {
      return Array.from(cases.values());
    },
    async get(caseId: string): Promise<SlaCase | undefined> {
      return cases.get(caseId);
    },
    async save(slaCase: SlaCase): Promise<void> {
      cases.set(slaCase.id, slaCase);
    },
  };
}
```

- [ ] **Step 5: Make the file-store adapter async**

In `lib/storage/case-store.ts`, the sync functions `getDemoCases`, `getDemoCase`, `saveDemoCase` STAY UNCHANGED (seed + tests depend on them). Only replace the `fileCaseStore` adapter at the bottom (lines 268-279) with an async wrapper:

```typescript
// ----- CaseStore interface adapter -----
// Wraps the synchronous function-style API to satisfy the async CaseStore
// contract from case-store-interface.ts. The file store is synchronous under
// the hood; we wrap each call in a resolved promise.

import type { CaseStore } from "./case-store-interface";

export const fileCaseStore: CaseStore = {
  async list(): Promise<SlaCase[]> {
    return getDemoCases();
  },
  async get(caseId: string): Promise<SlaCase | undefined> {
    return getDemoCase(caseId);
  },
  async save(slaCase: SlaCase): Promise<void> {
    saveDemoCase(slaCase);
  },
};
```

- [ ] **Step 6: Make the fixtures façade async**

Replace `lib/domain/fixtures.ts` with the async façade. The mutable `demoCases` array is removed (only `domain.test.ts` used it, and that test will switch to the sync seed API in Step 9):

```typescript
import { fileCaseStore } from "@/lib/storage/case-store";
import type { SlaCase } from "./types";

// Async façade over the configured case store. Server Components and Server
// Actions await these. Storage backend selection lives in the store layer.
export async function getDemoCases(): Promise<SlaCase[]> {
  return fileCaseStore.list();
}

export async function getDemoCase(caseId: string): Promise<SlaCase | undefined> {
  return fileCaseStore.get(caseId);
}

export async function saveDemoCase(slaCase: SlaCase): Promise<void> {
  await fileCaseStore.save(slaCase);
}
```

> NOTE: The factory (Task 4) later replaces `fileCaseStore` here with the configured store. For now it points at the file store to keep this commit's behavior identical.

- [ ] **Step 7: Update mock-adapter to await the store**

In `lib/verifier/mock-adapter.ts`, make `getReceipt` await (lines 24-27):

```typescript
  async getReceipt(caseId: string): Promise<Receipt | null> {
    const slaCase = await getDemoCase(caseId);
    return slaCase ? verifyCaseLocally(slaCase) : null;
  },
```

- [ ] **Step 8: Update receipt-export to await the store**

In `lib/export/receipt-export.ts`, `exportReceiptMarkdown` reads the case title via `getDemoCase`. Make the function async and await it. Change the signature line and the call:

```typescript
export async function exportReceiptMarkdown(receipt: Receipt): Promise<string> {
  increment("export_receipt_markdown");
  const safe = prepareForExport(receipt);
  const slaCase = await getDemoCase(safe.caseId);
  const title = slaCase?.title ?? safe.caseId;
```
(The rest of the function body is unchanged.)

This makes two more callers async:

**`app/receipt/[caseId]/page.tsx` line 27-29** — the `markdown` const must await.
Change:
```typescript
  const markdown = hasStoredReceipt
    ? exportReceiptMarkdown(receipt)
    : "Receipt pending explicit submission and read-back.\n";
```
to:
```typescript
  const markdown = hasStoredReceipt
    ? await exportReceiptMarkdown(receipt)
    : "Receipt pending explicit submission and read-back.\n";
```
This page is already `async function ReceiptPage`, so only `await` is added.
(Also apply the line 17 and line 37 `await getDemoCase(...)` changes from Step 10 here if doing this file in one pass.)

**`tests/unit/receipt-export.test.ts`** — the 4 `exportReceiptMarkdown` tests
(lines 46, 58, 66, 71) now await. Make each `it` callback async and await the
call:
```typescript
  it("includes decision, confidence, hash, clauses, citations, reasoning", async () => {
    const md = await exportReceiptMarkdown(sample);
    expect(md).toContain("# SLAProof Receipt:");
    expect(md).toContain("Decision: breach");
    expect(md).toContain("Confidence: 88%");
    expect(md).toContain(sample.receiptHash);
    expect(md).toContain("- 5% request failures for 5+ consecutive minutes");
    expect(md).toContain("ev-status");
    expect(md).toContain(sample.validatorReasoning);
    expect(md).toContain(sample.recommendedNextAction);
  });

  it("renders 'None' when no violated clauses", async () => {
    const md = await exportReceiptMarkdown({ ...sample, violatedClauses: [] });
    expect(md).toMatch(/## Violated Clauses\n- None/);
  });

  it("falls back to caseId when seed case is missing", async () => {
    const md = await exportReceiptMarkdown({ ...sample, caseId: "case-not-seeded" });
    expect(md).toContain("# SLAProof Receipt: case-not-seeded");
  });

  it("bumps export_receipt_markdown counter", async () => {
    await exportReceiptMarkdown(sample);
    expect(snapshot().counters.export_receipt_markdown).toBe(1);
  });
```

- [ ] **Step 9: Update domain.test.ts for async fixtures**

`tests/unit/domain.test.ts` imports `demoCases` and `getDemoCase` from `@/lib/domain/fixtures`. Switch to the sync seed API and await where needed.

Change the import on line 2 from:
```typescript
import { demoCases, getDemoCase } from "@/lib/domain/fixtures";
```
to:
```typescript
import { getDemoCases, getDemoCase } from "@/lib/storage/case-store";
```

Update the two tests that used the `demoCases` array (lines 12-26) to load synchronously:

```typescript
  it("exposes demo cases for all local verdict states", () => {
    const demoCases = getDemoCases();
    const decisions = new Set(demoCases.map((slaCase) => inferMockDecision(slaCase)));

    expect(decisions).toEqual(
      new Set(["breach", "no_breach", "inconclusive", "needs_more_evidence"]),
    );
  });

  it("keeps required seeded case fields valid where ready", () => {
    const demoCases = getDemoCases();
    for (const slaCase of demoCases.filter((item) => item.status === "ready")) {
      const result = validateSlaCase(slaCase);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });
```

The remaining `getDemoCase(...)` calls in this file now come from `case-store` (sync), so they need NO `await` — they keep working unchanged. Same for the `exportReceiptMarkdown` call on line 398: it now returns a Promise, so update that one assertion:

```typescript
  it("exports JSON and Markdown with key receipt fields", async () => {
    const receipt = verifyCaseLocally(getDemoCase("case-rpc-breach-001")!);

    expect(exportReceiptJson(receipt)).toContain('"decision": "breach"');
    expect(exportReceiptJson(receipt)).toContain(receipt.receiptHash);
    expect(await exportReceiptMarkdown(receipt)).toContain("Decision: breach");
    expect(await exportReceiptMarkdown(receipt)).toContain("## Evidence Citations");
  });
```

- [ ] **Step 10: Update the production call sites to await**

`app/cases/[caseId]/page.tsx` line 16: `const slaCase = await getDemoCase(caseId);`
Line 27 (inside `submitCase`): `const submittedCase = await getDemoCase(caseId);`

`app/receipt/[caseId]/page.tsx` line 17: `const slaCase = await getDemoCase(caseId);`
Line 37 (inside `submitCase`): `const submittedCase = await getDemoCase(caseId);`

`app/cases/new/actions.ts` line 56: `await saveDemoCase(validated.case);`

`app/page.tsx` (home page) uses the removed `demoCases` array. It is a Server
Component with no `"use client"`, so make it async and load cases once.
Change the import on line 3 from:
```typescript
import { demoCases } from "@/lib/domain/fixtures";
```
to:
```typescript
import { getDemoCases } from "@/lib/domain/fixtures";
```
Change the component signature on line 16 and add a load line at the top of the body:
```typescript
export default async function Home() {
  const readiness = getVerifierReadiness();
  const demoCases = await getDemoCases();
```
The rest of the component body is unchanged — `demoCases` is now a local
const instead of the imported array, so every `demoCases.map(...)`,
`demoCases.filter(...)`, `demoCases.length`, and `demoCases[0]` reference
keeps working.

These pages are already `async function` components and the `submitCase` closures are already `async`, so only the `await` keyword is added.

- [ ] **Step 11: Run the full unit suite + typecheck**

Run: `npm run typecheck && npx vitest run`
Expected: PASS — all unit tests green, no type errors. The memory-store test from Step 1 now passes against the async interface.

- [ ] **Step 12: Commit**

```bash
git add lib/storage/case-store-interface.ts lib/storage/case-store.ts lib/storage/case-store-memory.ts lib/domain/fixtures.ts lib/verifier/mock-adapter.ts lib/export/receipt-export.ts app/page.tsx app/cases/[caseId]/page.tsx app/receipt/[caseId]/page.tsx app/cases/new/actions.ts tests/unit/case-store-memory.test.ts tests/unit/domain.test.ts
git commit -m "refactor(storage): make CaseStore async (file store unchanged)"
```

---

## Task 3: Postgres-backed CaseStore

Implements the async `CaseStore` over Postgres. One JSONB blob per case. A
module-level `pg.Pool` singleton avoids exhausting connections. The pool is
created lazily so importing this module never opens a connection (keeps tests
that don't use Postgres fast).

**Files:**
- Create: `lib/storage/case-store-postgres.ts`

- [ ] **Step 1: Write the Postgres store**

Create `lib/storage/case-store-postgres.ts`:

```typescript
import { Pool } from "pg";
import type { SlaCase } from "@/lib/domain/types";
import type { CaseStore } from "./case-store-interface";
import { reportError } from "@/lib/observability/error-reporter";

let pool: Pool | undefined;

/**
 * Lazily create a singleton connection pool. Importing this module does not
 * open a connection; the first store operation does. `connectionString`
 * defaults to DATABASE_URL.
 */
export function getPool(connectionString = process.env.DATABASE_URL): Pool {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the Postgres case store.");
  }
  if (!pool) {
    pool = new Pool({ connectionString });
  }
  return pool;
}

/** Close the pool. Used by scripts and tests for clean shutdown. */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/**
 * Postgres CaseStore. Each case is stored as a single JSONB blob keyed by id.
 * The SlaCase shape inside `data` remains the application source of truth;
 * the SQL columns exist for ordering and operational queries.
 */
export function createPostgresCaseStore(
  connectionString = process.env.DATABASE_URL,
): CaseStore {
  return {
    async list(): Promise<SlaCase[]> {
      try {
        const { rows } = await getPool(connectionString).query<{ data: SlaCase }>(
          "SELECT data FROM cases ORDER BY created_at",
        );
        return rows.map((r) => r.data);
      } catch (error) {
        reportError(error, { phase: "pgCaseStore.list" });
        throw error;
      }
    },
    async get(caseId: string): Promise<SlaCase | undefined> {
      try {
        const { rows } = await getPool(connectionString).query<{ data: SlaCase }>(
          "SELECT data FROM cases WHERE id = $1",
          [caseId],
        );
        return rows[0]?.data;
      } catch (error) {
        reportError(error, { phase: "pgCaseStore.get", caseId });
        throw error;
      }
    },
    async save(slaCase: SlaCase): Promise<void> {
      try {
        await getPool(connectionString).query(
          `INSERT INTO cases (id, data) VALUES ($1, $2)
           ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = now()`,
          [slaCase.id, slaCase],
        );
      } catch (error) {
        reportError(error, { phase: "pgCaseStore.save", caseId: slaCase.id });
        throw error;
      }
    },
  };
}
```

> NOTE: `pg` serializes a JS object passed as a parameter to a `jsonb` column
> as JSON automatically. No manual `JSON.stringify` is needed for `$2`.

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS — `pg` types resolve, no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/storage/case-store-postgres.ts
git commit -m "feat(storage): Postgres-backed CaseStore (JSONB blob per case)"
```

---

## Task 4: Store factory and wire it into the façade

The factory selects file vs postgres by `SLAPROOF_STORE` (default `file`).
The fixtures façade then depends on the factory instead of `fileCaseStore`
directly, so flipping the env var switches the whole app.

**Files:**
- Create: `lib/storage/case-store-factory.ts`
- Modify: `lib/domain/fixtures.ts`
- Test: `tests/unit/case-store-factory.test.ts`

- [ ] **Step 1: Write the factory test (failing)**

Create `tests/unit/case-store-factory.test.ts`:

```typescript
import { describe, expect, it, afterEach } from "vitest";
import { getCaseStore, resetCaseStore } from "@/lib/storage/case-store-factory";
import { fileCaseStore } from "@/lib/storage/case-store";

afterEach(() => {
  resetCaseStore();
  delete process.env.SLAPROOF_STORE;
});

describe("getCaseStore", () => {
  it("defaults to the file store when SLAPROOF_STORE is unset", () => {
    delete process.env.SLAPROOF_STORE;
    resetCaseStore();
    expect(getCaseStore()).toBe(fileCaseStore);
  });

  it("returns the file store when SLAPROOF_STORE=file", () => {
    process.env.SLAPROOF_STORE = "file";
    resetCaseStore();
    expect(getCaseStore()).toBe(fileCaseStore);
  });

  it("returns a Postgres store (not the file store) when SLAPROOF_STORE=postgres", () => {
    process.env.SLAPROOF_STORE = "postgres";
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    resetCaseStore();
    const store = getCaseStore();
    expect(store).not.toBe(fileCaseStore);
    expect(typeof store.list).toBe("function");
  });
});
```

- [ ] **Step 2: Run the factory test to verify it fails**

Run: `npx vitest run tests/unit/case-store-factory.test.ts`
Expected: FAIL — module `case-store-factory` does not exist yet.

- [ ] **Step 3: Write the factory**

Create `lib/storage/case-store-factory.ts`:

```typescript
import type { CaseStore } from "./case-store-interface";
import { fileCaseStore } from "./case-store";
import { createPostgresCaseStore } from "./case-store-postgres";

let cached: CaseStore | undefined;

/**
 * Select the case store backend from SLAPROOF_STORE.
 *   - "postgres" -> Postgres store (requires DATABASE_URL)
 *   - "file" (default) -> file-backed store
 * The result is cached so the Postgres pool is created once.
 */
export function getCaseStore(): CaseStore {
  if (cached) return cached;
  const mode = (process.env.SLAPROOF_STORE ?? "file").toLowerCase();
  cached = mode === "postgres" ? createPostgresCaseStore() : fileCaseStore;
  return cached;
}

/** Clear the cached store. Used by tests to re-read env. */
export function resetCaseStore(): void {
  cached = undefined;
}
```

- [ ] **Step 4: Point the façade at the factory**

In `lib/domain/fixtures.ts`, replace the `fileCaseStore` import and usages with
the factory so the configured store is used:

```typescript
import { getCaseStore } from "@/lib/storage/case-store-factory";
import type { SlaCase } from "./types";

// Async façade over the configured case store. Server Components and Server
// Actions await these. Backend selection lives in the factory.
export async function getDemoCases(): Promise<SlaCase[]> {
  return getCaseStore().list();
}

export async function getDemoCase(caseId: string): Promise<SlaCase | undefined> {
  return getCaseStore().get(caseId);
}

export async function saveDemoCase(slaCase: SlaCase): Promise<void> {
  await getCaseStore().save(slaCase);
}
```

- [ ] **Step 5: Run the factory test + full suite**

Run: `npx vitest run tests/unit/case-store-factory.test.ts && npm run typecheck`
Expected: PASS — factory returns file store by default and a distinct Postgres store when configured.

- [ ] **Step 6: Commit**

```bash
git add lib/storage/case-store-factory.ts lib/domain/fixtures.ts tests/unit/case-store-factory.test.ts
git commit -m "feat(storage): env-selected case store factory"
```

---

## Task 5: Migration SQL and migrate script

**Files:**
- Create: `lib/storage/migrations/001_init.sql`
- Create: `scripts/migrate.mjs`
- Modify: `package.json` (add `db:migrate`)

- [ ] **Step 1: Write the schema migration**

Create `lib/storage/migrations/001_init.sql`:

```sql
-- SLAProof case store schema.
-- One row per SLA case; the case payload lives in the `data` JSONB column.
-- created_at / updated_at exist for ordering and operational queries.
create table if not exists cases (
  id          text primary key,
  data        jsonb        not null,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);
```

- [ ] **Step 2: Write the migrate script**

Create `scripts/migrate.mjs`:

```javascript
#!/usr/bin/env node
// Run all SQL files in lib/storage/migrations in lexical order.
// Idempotent: migrations use `if not exists`.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "lib", "storage", "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required to run migrations.");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const sql = readFileSync(path.join(migrationsDir, file), "utf-8");
      console.log(`Applying ${file} ...`);
      await client.query(sql);
    }
    console.log(`Applied ${files.length} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Add the db:migrate script**

In `package.json` `scripts`, add after `"readiness:check"`:

```json
    "db:migrate": "node scripts/migrate.mjs",
```

- [ ] **Step 4: Verify the script parses (no DB needed)**

Run: `node --check scripts/migrate.mjs`
Expected: PASS — no syntax errors. (Running it requires a live DB; covered in the runbook.)

- [ ] **Step 5: Commit**

```bash
git add lib/storage/migrations/001_init.sql scripts/migrate.mjs package.json
git commit -m "feat(db): schema migration + db:migrate script"
```

---

## Task 6: Idempotent seed

Seeds the 4 demo cases ONLY when the table is empty, so it never clobbers
pilot data. Reuses the canonical seed data exported from `case-store.ts`.

**Files:**
- Modify: `lib/storage/case-store.ts` (export the seed array)
- Create: `lib/storage/seed.ts`
- Create: `scripts/seed.mjs`
- Modify: `package.json` (add `db:seed`)

- [ ] **Step 1: Export the seed array from case-store.ts**

In `lib/storage/case-store.ts`, change the declaration on line 10 from:
```typescript
const initialDemoCases: SlaCase[] = [
```
to:
```typescript
export const initialDemoCases: SlaCase[] = [
```
(No other change to the array contents.)

- [ ] **Step 2: Write the seed function**

Create `lib/storage/seed.ts`:

```typescript
import type { Pool } from "pg";
import { initialDemoCases } from "./case-store";

/**
 * Insert the demo cases only when the table is empty. Returns the number of
 * cases inserted (0 when the table already has data). Never overwrites
 * existing rows.
 */
export async function seedIfEmpty(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ count: string }>("SELECT count(*) FROM cases");
  if (Number(rows[0].count) > 0) {
    return 0;
  }
  for (const slaCase of initialDemoCases) {
    await pool.query(
      `INSERT INTO cases (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [slaCase.id, slaCase],
    );
  }
  return initialDemoCases.length;
}
```

- [ ] **Step 3: Write the seed script**

Create `scripts/seed.mjs`:

```javascript
#!/usr/bin/env node
// Seed demo cases only when the cases table is empty.
import pg from "pg";
import { seedIfEmpty } from "../lib/storage/seed.ts";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required to seed.");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url });
  try {
    const inserted = await seedIfEmpty(pool);
    console.log(
      inserted > 0
        ? `Seeded ${inserted} demo case(s).`
        : "Table already has data; skipped seeding.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

> NOTE: `scripts/seed.mjs` imports a `.ts` file. Run it with a TypeScript
> loader. The package script in Step 4 uses `node --import tsx` — add `tsx` as
> a dev dependency if not present (`npm i -D tsx`). If the project prefers no
> new tooling, inline the seed array into the script instead. The plan assumes
> `tsx` since the repo already runs `.mjs` scripts and `tsx` is the standard
> loader.

- [ ] **Step 4: Add tsx and the db:seed script**

Run: `npm install --save-dev tsx@^4.19.2`

In `package.json` `scripts`, add after `"db:migrate"`:
```json
    "db:seed": "node --import tsx scripts/seed.mjs",
```

- [ ] **Step 5: Verify the seed module typechecks and script parses**

Run: `npm run typecheck && node --check scripts/seed.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/storage/case-store.ts lib/storage/seed.ts scripts/seed.mjs package.json package-lock.json
git commit -m "feat(db): idempotent seed (seedIfEmpty) + db:seed script"
```

---

## Task 7: Env validation for Postgres mode

When `SLAPROOF_STORE=postgres`, `DATABASE_URL` becomes required and must look
like a Postgres connection string. This fails fast at boot in production via
the existing `instrumentation.ts` hook.

**Files:**
- Modify: `lib/config/env-validation.ts`
- Test: `tests/unit/env-validation.test.ts`

- [ ] **Step 1: Write the failing test**

Create (or append to) `tests/unit/env-validation.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { validateEnv } from "@/lib/config/env-validation";

describe("validateEnv Postgres mode", () => {
  it("requires DATABASE_URL when SLAPROOF_STORE=postgres", () => {
    const result = validateEnv({ SLAPROOF_STORE: "postgres" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.key === "DATABASE_URL")).toBe(true);
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    const result = validateEnv({
      SLAPROOF_STORE: "postgres",
      DATABASE_URL: "mysql://user:pass@localhost/db",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.key === "DATABASE_URL")).toBe(true);
  });

  it("accepts a valid postgres DATABASE_URL", () => {
    const result = validateEnv({
      SLAPROOF_STORE: "postgres",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
    });
    expect(result.issues.some((i) => i.key === "DATABASE_URL")).toBe(false);
  });

  it("does not require DATABASE_URL when SLAPROOF_STORE is unset (file mode)", () => {
    const result = validateEnv({});
    expect(result.issues.some((i) => i.key === "DATABASE_URL")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/env-validation.test.ts`
Expected: FAIL — no `DATABASE_URL` rule exists yet.

- [ ] **Step 3: Add the DATABASE_URL rule**

In `lib/config/env-validation.ts`, add a constant near the other patterns (after line 15):

```typescript
const POSTGRES_URL = /^postgres(ql)?:\/\/[^\s]+$/i;
```

Then inside `validateEnv`, after the `verifierMode` block (after line 29), add:

```typescript
  const storeMode = (env.SLAPROOF_STORE ?? "file").toLowerCase();
  if (storeMode === "postgres") {
    requireString(
      env,
      "DATABASE_URL",
      issues,
      POSTGRES_URL,
      "must be a postgres:// or postgresql:// connection string",
    );
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/env-validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/config/env-validation.ts tests/unit/env-validation.test.ts
git commit -m "feat(config): require DATABASE_URL in postgres store mode"
```

---

## Task 8: Health endpoint DB ping

When in Postgres mode, `/api/health` pings the DB (`SELECT 1`) and reports
degraded (503) when it cannot connect. File mode is unaffected.

**Files:**
- Modify: `app/api/health/route.ts`
- Test: `tests/unit/health-db.test.ts`

- [ ] **Step 1: Write the failing test for the DB-ping helper**

Create `tests/unit/health-db.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { pingDatabase } from "@/lib/storage/health-ping";

describe("pingDatabase", () => {
  it("returns skipped status in file mode", async () => {
    const result = await pingDatabase({ SLAPROOF_STORE: "file" });
    expect(result.checked).toBe(false);
    expect(result.ok).toBe(true);
  });

  it("returns ok when the query succeeds", async () => {
    const fakePool = { query: async () => ({ rows: [{ "?column?": 1 }] }) };
    const result = await pingDatabase(
      { SLAPROOF_STORE: "postgres", DATABASE_URL: "postgres://x" },
      () => fakePool as never,
    );
    expect(result.checked).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("returns not-ok when the query throws", async () => {
    const fakePool = {
      query: async () => {
        throw new Error("connection refused");
      },
    };
    const result = await pingDatabase(
      { SLAPROOF_STORE: "postgres", DATABASE_URL: "postgres://x" },
      () => fakePool as never,
    );
    expect(result.checked).toBe(true);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/health-db.test.ts`
Expected: FAIL — `lib/storage/health-ping` does not exist.

- [ ] **Step 3: Write the ping helper**

Create `lib/storage/health-ping.ts`:

```typescript
import type { Pool } from "pg";
import { getPool } from "./case-store-postgres";

export type DbPingResult = { checked: boolean; ok: boolean; error?: string };

type EnvLike = Record<string, string | undefined>;

/**
 * Ping the database when in Postgres mode. In file mode the check is skipped
 * and reported as ok. `poolFactory` is injectable for tests.
 */
export async function pingDatabase(
  env: EnvLike = process.env,
  poolFactory: () => Pool = () => getPool(env.DATABASE_URL),
): Promise<DbPingResult> {
  const mode = (env.SLAPROOF_STORE ?? "file").toLowerCase();
  if (mode !== "postgres") {
    return { checked: false, ok: true };
  }
  try {
    await poolFactory().query("SELECT 1");
    return { checked: true, ok: true };
  } catch (error) {
    return { checked: true, ok: false, error: (error as Error).message };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/health-db.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the ping into the health route**

In `app/api/health/route.ts`, add to the `HealthStatus` type after `verifier`:

```typescript
  database: {
    checked: boolean;
    ok: boolean;
  };
```

Import the helper at the top:
```typescript
import { pingDatabase } from "@/lib/storage/health-ping";
```

In `GET`, after `const readiness = getVerifierReadiness();`:
```typescript
  const db = await pingDatabase();
```

Change the `status` field and add `database` to the response object:
```typescript
    status: readiness.ready && db.ok ? "ok" : "degraded",
```
```typescript
    database: { checked: db.checked, ok: db.ok },
```

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npm run typecheck && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/health/route.ts lib/storage/health-ping.ts tests/unit/health-db.test.ts
git commit -m "feat(health): DB ping in postgres mode (503 on failure)"
```

---

## Task 9: Postgres integration test (env-guarded)

One integration test exercises the real Postgres adapter against a live DB.
It is skipped when `TEST_DATABASE_URL` is absent, so CI does not require
Postgres. When the var is set, it migrates a temp table, round-trips a case,
and cleans up.

**Files:**
- Create: `tests/integration/case-store-postgres.test.ts`

- [ ] **Step 1: Write the env-guarded integration test**

Create `tests/integration/case-store-postgres.test.ts`:

```typescript
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createPostgresCaseStore, getPool, closePool } from "@/lib/storage/case-store-postgres";
import type { SlaCase } from "@/lib/domain/types";

const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const sample: SlaCase = {
  id: "case-pg-int-001",
  title: "Integration case",
  providerName: "Test RPC",
  chain: "ethereum-mainnet",
  endpointLabel: "test",
  status: "ready",
  incidentWindow: { startUtc: "2026-05-22T10:00:00Z", endUtc: "2026-05-22T10:30:00Z" },
  incidentSummary: "test",
  slaTerms: { availabilityTarget: "99.9%", errorThreshold: "5%", latencyThreshold: "", exclusions: "", creditRule: "" },
  evidence: [],
  createdAt: "2026-05-22T10:00:00Z",
  updatedAt: "2026-05-22T10:00:00Z",
};

maybe("Postgres case store (integration)", () => {
  beforeAll(async () => {
    const pool = getPool(url);
    await pool.query(`create table if not exists cases (
      id text primary key, data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now())`);
    await pool.query("DELETE FROM cases WHERE id = $1", [sample.id]);
  });

  afterAll(async () => {
    const pool = getPool(url);
    await pool.query("DELETE FROM cases WHERE id = $1", [sample.id]);
    await closePool();
  });

  it("saves and reads back a case", async () => {
    const store = createPostgresCaseStore(url);
    await store.save(sample);
    const read = await store.get(sample.id);
    expect(read?.title).toBe("Integration case");
  });

  it("updates an existing case on save (upsert)", async () => {
    const store = createPostgresCaseStore(url);
    await store.save({ ...sample, title: "Updated" });
    const read = await store.get(sample.id);
    expect(read?.title).toBe("Updated");
  });

  it("lists the saved case", async () => {
    const store = createPostgresCaseStore(url);
    const all = await store.list();
    expect(all.some((c) => c.id === sample.id)).toBe(true);
  });

  it("returns undefined for an unknown case", async () => {
    const store = createPostgresCaseStore(url);
    expect(await store.get("nope-not-real")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Widen the vitest include glob to pick up integration tests**

`vitest.config.ts` currently has `include: ["tests/unit/**/*.test.ts"]`, which
excludes `tests/integration`. Change line 12 to:
```typescript
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
```
This keeps all unit tests and adds the integration directory. The integration
suite self-skips when `TEST_DATABASE_URL` is unset, so widening the glob is
safe for CI.

- [ ] **Step 3: Confirm the test is skipped without TEST_DATABASE_URL**

Run: `npx vitest run tests/integration/case-store-postgres.test.ts`
Expected: PASS with the suite reported as skipped (no `TEST_DATABASE_URL` in the dev environment).

- [ ] **Step 4: Commit**

```bash
git add tests/integration/case-store-postgres.test.ts vitest.config.ts
git commit -m "test(storage): env-guarded Postgres integration test"
```

---

## Task 10: Env example and Postgres runbook

**Files:**
- Modify: `.env.local.example`
- Create: `docs/runbooks/postgres-deployment.md`
- Modify: `README.md` (link the runbook)

- [ ] **Step 1: Document the new env vars**

Append to `.env.local.example`:

```bash
# --- Managed database (optional) ---
# Store backend: "file" (default, pilot) or "postgres" (managed DB).
SLAPROOF_STORE=file
# Required when SLAPROOF_STORE=postgres. Hosted Postgres (Neon/Supabase) or self-host.
# DATABASE_URL=postgres://user:password@host:5432/dbname
# Used only by the env-guarded Postgres integration test:
# TEST_DATABASE_URL=postgres://user:password@host:5432/dbname_test
```

- [ ] **Step 2: Write the runbook**

Create `docs/runbooks/postgres-deployment.md`:

```markdown
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
```

- [ ] **Step 3: Link the runbook from the README**

In `README.md`, under the `### Operations` list, add:
```markdown
- [Postgres Deployment Runbook](docs/runbooks/postgres-deployment.md)
```

- [ ] **Step 4: Verify the full quality gate**

Run: `npm run verify:demo`
Expected: PASS — lint, typecheck, unit tests, and build all succeed in the default file mode.

- [ ] **Step 5: Commit**

```bash
git add .env.local.example docs/runbooks/postgres-deployment.md README.md
git commit -m "docs(db): Postgres deployment runbook + env reference"
```

---

## Final Verification

After all tasks:

- [ ] `npm run verify:demo` passes (lint + typecheck + unit + build) in file mode.
- [ ] `npx vitest run` shows the Postgres integration suite skipped (no `TEST_DATABASE_URL`).
- [ ] Default behavior is unchanged: app runs on the file store with no new required env.
- [ ] With `SLAPROOF_STORE=postgres` + `DATABASE_URL`, `db:migrate` + `db:seed` provision the DB and the app reads/writes cases against Postgres.
- [ ] `/api/health` reports `database.ok` in postgres mode and 503 when the DB is down.
- [ ] No `NEXT_PUBLIC_` exposure of `DATABASE_URL`.
