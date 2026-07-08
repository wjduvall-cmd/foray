import * as fs from "fs";
import * as path from "path";
import { Client } from "pg";
import { env } from "../config/env";

/**
 * `npm run migrate` — applies backend/migrations/*.sql in order against
 * DATABASE_URL. Plain SQL, Supabase-compatible (see migrations/README
 * intent in 0001_extensions.sql) — this script is a thin runner, not an
 * ORM migration framework, on purpose (local-first, no cloud dependency).
 *
 * Degrades gracefully when DATABASE_URL is unset: prints what it WOULD do
 * and exits 0 rather than failing, so `npm install && npm test` never
 * requires a live Postgres instance.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "migrations");

async function main(): Promise<void> {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (!env.databaseUrl) {
    console.log("DATABASE_URL is not set — dry-run only. Migrations that WOULD be applied, in order:");
    for (const f of files) console.log(`  - ${f}`);
    console.log("\nSet DATABASE_URL in the repo-root .env (a local Postgres or a Supabase project URL) to actually apply them.");
    return;
  }

  const client = new Client({ connectionString: env.databaseUrl });
  await client.connect();
  try {
    await client.query(
      `create table if not exists schema_migrations (
         filename text primary key,
         applied_at timestamptz not null default now()
       )`
    );

    for (const file of files) {
      const already = await client.query("select 1 from schema_migrations where filename = $1", [file]);
      if ((already.rowCount ?? 0) > 0) {
        console.log(`skip (already applied): ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      console.log(`applying: ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (filename) values ($1)", [file]);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw new Error(`migration ${file} failed: ${(err as Error).message}`);
      }
    }
    console.log("all migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("migrate failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
