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
