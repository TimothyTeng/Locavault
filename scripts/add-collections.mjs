// Surgically create the collections / collection_items tables and add the
// items.checked_out column (the drizzle migration journal is out of sync — see
// CLAUDE.md — so we apply schema changes directly). Idempotent.
// Run with:  node --env-file=.env scripts/add-collections.mjs
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 1. items.checked_out — transient "packed/out" loan state.
const itemInfo = await client.execute("PRAGMA table_info(items)");
if (itemInfo.rows.some((r) => r.name === "checked_out")) {
  console.log("items.checked_out already exists — nothing to do.");
} else {
  await client.execute(
    "ALTER TABLE items ADD COLUMN checked_out INTEGER NOT NULL DEFAULT 0",
  );
  console.log("Added items.checked_out (INTEGER, default 0).");
}

// 2. collections
await client.execute(`
  CREATE TABLE IF NOT EXISTS collections (
    id          TEXT PRIMARY KEY,
    store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    kind        TEXT NOT NULL DEFAULT 'packing',
    checked_out INTEGER NOT NULL DEFAULT 0,
    user_id     TEXT NOT NULL,
    created_at  INTEGER
  )
`);
console.log("Ensured table: collections");

// 3. collection_items
await client.execute(`
  CREATE TABLE IF NOT EXISTS collection_items (
    id            TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    item_id       TEXT REFERENCES items(id) ON DELETE SET NULL,
    name          TEXT NOT NULL,
    desired_qty   INTEGER NOT NULL DEFAULT 1,
    checked       INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER
  )
`);
console.log("Ensured table: collection_items");

console.log("Done.");
