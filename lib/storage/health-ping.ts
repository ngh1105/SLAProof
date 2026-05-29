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
