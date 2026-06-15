// Surgically add the `fixture` column to the blocks table (the drizzle migration
// journal is out of sync — see CLAUDE.md — so we apply this directly).
// Idempotent. Run with:  node --env-file=.env scripts/add-fixture-column.mjs
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

for (const table of ["blocks", "template_blocks"]) {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  const hasFixture = info.rows.some((r) => r.name === "fixture");
  if (hasFixture) {
    console.log(`${table}.fixture already exists — nothing to do.`);
  } else {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN fixture TEXT`);
    console.log(`Added ${table}.fixture (TEXT, nullable).`);
  }
}

const counts = await client.execute(
  "SELECT fixture, COUNT(*) AS n FROM blocks GROUP BY fixture",
);
console.log("blocks fixture distribution:");
for (const r of counts.rows) console.log(`  ${r.fixture ?? "(plain)"}: ${r.n}`);
