// Surgically add the trade columns (items.for_trade, items.trade_note) and the
// trade_offers table (drizzle migration journal is out of sync — see CLAUDE.md).
// Idempotent. Run with:  node --env-file=.env scripts/add-trade.mjs
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const itemInfo = await client.execute("PRAGMA table_info(items)");
const cols = new Set(itemInfo.rows.map((r) => r.name));

if (cols.has("for_trade")) {
  console.log("items.for_trade already exists.");
} else {
  await client.execute(
    "ALTER TABLE items ADD COLUMN for_trade INTEGER NOT NULL DEFAULT 0",
  );
  console.log("Added items.for_trade.");
}

if (cols.has("trade_note")) {
  console.log("items.trade_note already exists.");
} else {
  await client.execute("ALTER TABLE items ADD COLUMN trade_note TEXT");
  console.log("Added items.trade_note.");
}

await client.execute(`
  CREATE TABLE IF NOT EXISTS trade_offers (
    id               TEXT PRIMARY KEY,
    listing_item_id  TEXT REFERENCES items(id) ON DELETE SET NULL,
    listing_store_id TEXT REFERENCES stores(id) ON DELETE SET NULL,
    listing_name     TEXT NOT NULL,
    offered_item_id  TEXT REFERENCES items(id) ON DELETE SET NULL,
    offered_name     TEXT,
    from_user_id     TEXT NOT NULL,
    to_user_id       TEXT NOT NULL,
    message          TEXT,
    status           TEXT NOT NULL DEFAULT 'pending',
    created_at       INTEGER
  )
`);
console.log("Ensured table: trade_offers");

console.log("Done.");
