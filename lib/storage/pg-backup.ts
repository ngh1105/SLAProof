import type { CaseStore } from "@/lib/storage/case-store-interface";
import type { SlaCase } from "@/lib/domain/types";

/**
 * Serializable snapshot of every case in a store. Pure data: it carries no
 * connection details or store handles, so it can be written to disk, shipped,
 * and replayed into any CaseStore implementation.
 */
export type BackupSnapshot = {
  takenAt: string;
  store: "postgres";
  count: number;
  rows: SlaCase[];
};

/**
 * Read every case out of the store and return an in-memory snapshot.
 *
 * Decoupled from any CLI or driver: it only touches the CaseStore interface,
 * so the same helper backs both the production Postgres store and test fakes.
 */
export async function dumpCases(store: CaseStore): Promise<BackupSnapshot> {
  const rows = await store.list();
  return {
    takenAt: new Date().toISOString(),
    store: "postgres",
    count: rows.length,
    rows,
  };
}

/**
 * Replay a snapshot into a store, upserting each row via {@link CaseStore.save}.
 * Returns the number of cases restored.
 *
 * Throws if the snapshot is malformed (missing or non-array `rows`) rather than
 * silently restoring nothing, so a corrupt backup fails loudly.
 */
export async function restoreCases(
  store: CaseStore,
  snapshot: BackupSnapshot,
): Promise<number> {
  if (!snapshot || !Array.isArray(snapshot.rows)) {
    throw new Error("restoreCases: snapshot.rows must be an array");
  }

  for (const slaCase of snapshot.rows) {
    await store.save(slaCase);
  }

  return snapshot.rows.length;
}
