import type { SlaCase } from "@/lib/domain/types";

/**
 * Case store interface. Abstracts persistence so the file-backed pilot
 * implementation can be swapped for a managed database in production
 * without touching callers.
 *
 * Methods are intentionally synchronous for the pilot. When moving to a
 * networked store, replace with the async variant in `case-store-async.ts`.
 */
export interface CaseStore {
  list(): SlaCase[];
  get(caseId: string): SlaCase | undefined;
  save(slaCase: SlaCase): void;
}
