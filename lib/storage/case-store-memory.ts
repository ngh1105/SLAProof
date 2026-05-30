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
