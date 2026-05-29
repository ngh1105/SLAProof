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
