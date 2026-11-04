// Applies every SQL file in db/migrations (in name order) to DATABASE_URL.
// Usage:  node --env-file=.env.local scripts/db-migrate.mjs
// The migrations are idempotent, so re-running is safe.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { neon, neonConfig } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local (Vercel → Storage → Neon → .env.local tab) and try again.");
  process.exit(1);
}
if (process.env.NEON_LOCAL_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_LOCAL_FETCH_ENDPOINT;

const sql = neon(url);
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const files = readdirSync(dir).filter(f => f.endsWith(".sql")).sort();

for (const file of files) {
  const text = readFileSync(join(dir, file), "utf8")
    .split("\n").filter(line => !line.trim().startsWith("--")).join("\n");
  const statements = text.split(";").map(s => s.trim()).filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  console.log(`Applied ${file} (${statements.length} statements)`);
}
console.log("Database is up to date.");
