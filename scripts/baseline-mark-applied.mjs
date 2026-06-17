// Mark the committed Drizzle migrations as already-applied on an EXISTING DB.
//
// The live Turso DB was built ahead of the migration journal, so a plain
// `drizzle-kit migrate` would try to re-CREATE existing tables and fail. After
// squashing the journal to a single baseline (drizzle/0000_baseline.sql that
// mirrors schema.ts), run this ONCE against the existing DB: it records each
// journal migration in `__drizzle_migrations` exactly as drizzle-orm's libSQL
// migrator would, so `migrate` sees them as applied and becomes a no-op. A
// brand-new/empty DB skips this script and just runs `drizzle-kit migrate`.
//
// Idempotent. Run with:  node --env-file=.env scripts/baseline-mark-applied.mjs
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const journal = JSON.parse(
  readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8"),
);

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Same shape drizzle-orm's libSQL migrator uses.
await client.execute(
  "CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (id INTEGER PRIMARY KEY, hash text NOT NULL, created_at numeric)",
);

for (const entry of journal.entries) {
  const sql = readFileSync(join(root, "drizzle", `${entry.tag}.sql`), "utf8");
  const hash = createHash("sha256").update(sql).digest("hex");

  const existing = await client.execute({
    sql: "SELECT id FROM `__drizzle_migrations` WHERE hash = ?",
    args: [hash],
  });
  if (existing.rows.length) {
    console.log(`already marked: ${entry.tag}`);
    continue;
  }

  await client.execute({
    sql: "INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)",
    args: [hash, entry.when],
  });
  console.log(`marked applied: ${entry.tag} (created_at=${entry.when})`);
}

// Sanity: migrate is a no-op iff the newest recorded created_at is >= the last
// journal entry's `when`.
const last = journal.entries[journal.entries.length - 1];
const newest = await client.execute(
  "SELECT MAX(created_at) AS m FROM `__drizzle_migrations`",
);
const ok = last && Number(newest.rows[0].m) >= last.when;
console.log(
  ok
    ? "✓ migrations recorded as applied — `drizzle-kit migrate` will be a no-op."
    : "⚠ recorded timestamps look off; check before running migrate.",
);
