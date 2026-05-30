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
