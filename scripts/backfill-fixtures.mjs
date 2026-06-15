// Backfill block.fixture from each block's label so existing stores light up
// with furniture. Only touches standard blocks that don't already have a
// fixture; dividers/stairs are left plain. Idempotent.
// Run with:  node --env-file=.env scripts/backfill-fixtures.mjs
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Specific patterns first; falls back to "shelf" for unmatched storage zones.
const RULES = [
  [/fridge|refriger/i, "fridge"],
  [/freezer/i, "freezer"],
  [/wardrobe|closet/i, "wardrobe"],
  [/book/i, "bookshelf"],
  [/pantry/i, "pantry"],
  [/cabinet|cupboard|press/i, "cabinet"],
  [/drawer/i, "drawers"],
  [/night.?stand|bedside/i, "nightstand"],
  [/rack/i, "rack"],
  [/counter|bench|island|worktop/i, "counter"],
  [/desk/i, "desk"],
  [/table/i, "table"],
  [/stove|oven|cooker|\bhob\b/i, "stove"],
  [/sink|basin/i, "sink"],
  [/wash(er|ing)|laundry|dryer/i, "washer"],
  [/sofa|couch|settee/i, "sofa"],
  [/\bbed\b/i, "bed"],
  [/bath|\btub\b/i, "bathtub"],
  [/toilet|\bwc\b|lavatory/i, "toilet"],
  [/plant|\bpot\b/i, "plant"],
  [/bin|basket|hamper|crate|\bbox\b/i, "bin"],
  [/shelf|shelv/i, "shelf"],
];

function infer(label) {
  const l = (label ?? "").trim();
  for (const [re, fx] of RULES) if (re.test(l)) return fx;
  return "shelf"; // storage zones default to shelving
}

const rows = (
  await client.execute(
    "SELECT block_id, label, kind, fixture FROM blocks WHERE kind = 'standard' AND fixture IS NULL",
  )
).rows;

let updated = 0;
for (const b of rows) {
  const fx = infer(b.label);
  await client.execute({
    sql: "UPDATE blocks SET fixture = ? WHERE block_id = ?",
    args: [fx, b.block_id],
  });
  console.log(`  "${b.label || "(unlabelled)"}" → ${fx}`);
  updated++;
}
console.log(`\nBackfilled ${updated} block(s).`);
