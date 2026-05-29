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
