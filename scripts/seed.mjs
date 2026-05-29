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
