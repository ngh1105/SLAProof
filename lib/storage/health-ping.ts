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
  timeoutMs = 2000,
): Promise<DbPingResult> {
  const mode = (env.SLAPROOF_STORE ?? "file").toLowerCase();
  if (mode !== "postgres") {
    return { checked: false, ok: true };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`DB ping timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });
    await Promise.race([poolFactory().query("SELECT 1"), timeout]);
    return { checked: true, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { checked: true, ok: false, error: message };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
