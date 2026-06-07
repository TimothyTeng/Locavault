// Seed a few public "starter" templates based on real room layouts.
// Idempotent: skips any template whose id already exists.
// Run with:  node --env-file=.env scripts/seed-templates.mjs
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Block style presets → { background (tinted), border, kind }
const S = {
  wall: { bg: "#1e252022", border: "#1e2520", kind: "divider" },
  door: { bg: "#3d8a5822", border: "#3d8a58", kind: "divider" },
  shelf: { bg: "#2d6b4422", border: "#2d6b44", kind: "standard" },
  cabinet: { bg: "#b8821e22", border: "#b8821e", kind: "standard" },
  counter: { bg: "#4a90b822", border: "#4a90b8", kind: "standard" },
  zone: { bg: "#6d7d7222", border: "#6d7d72", kind: "standard" },
};

// Each block: [x, y, w, h, styleKey, label]
const TEMPLATES = [
  {
    id: "tpl-kitchen-pantry",
    name: "Kitchen Pantry",
    description: "A walk-in pantry with zoned shelving for dry goods.",
    tags: ["kitchen", "food", "home"],
    rows: 10,
    cols: 10,
    blocks: [
      [0, 0, 10, 1, "wall", "Wall"],
      [0, 9, 7, 1, "wall", "Wall"],
      [7, 9, 3, 1, "door", "Door"],
      [1, 2, 3, 1, "shelf", "Canned Goods"],
      [1, 4, 3, 1, "shelf", "Grains & Pasta"],
      [1, 6, 3, 1, "shelf", "Snacks"],
      [6, 2, 3, 2, "cabinet", "Baking"],
      [6, 5, 3, 2, "shelf", "Spices"],
    ],
  },
  {
    id: "tpl-garage",
    name: "Garage",
    description: "Workbench, tool storage and shelving for a two-bay garage.",
    tags: ["garage", "tools", "home"],
    rows: 10,
    cols: 12,
    blocks: [
      [0, 0, 12, 1, "wall", "Wall"],
      [0, 9, 9, 1, "wall", "Wall"],
      [9, 9, 3, 1, "door", "Garage Door"],
      [1, 2, 4, 2, "counter", "Workbench"],
      [1, 5, 4, 2, "zone", "Tool Storage"],
      [7, 2, 4, 2, "shelf", "Shelving Unit"],
      [7, 5, 4, 2, "shelf", "Sports & Outdoor"],
    ],
  },
  {
    id: "tpl-bedroom-wardrobe",
    name: "Bedroom Wardrobe",
    description: "Hanging rails, folded storage and a shoe rack.",
    tags: ["closet", "clothing", "bedroom"],
    rows: 8,
    cols: 8,
    blocks: [
      [0, 0, 8, 1, "wall", "Wall"],
      [0, 7, 5, 1, "wall", "Wall"],
      [5, 7, 3, 1, "door", "Door"],
      [1, 1, 3, 2, "zone", "Hanging Rail"],
      [1, 4, 3, 2, "shelf", "Folded Clothes"],
      [5, 1, 2, 2, "shelf", "Accessories"],
      [5, 4, 2, 2, "cabinet", "Drawers"],
      [1, 6, 6, 1, "zone", "Shoe Rack"],
    ],
  },
  {
    id: "tpl-home-office",
    name: "Home Office",
    description: "Desk, bookshelf, filing cabinet and supplies.",
    tags: ["office", "work", "home"],
    rows: 8,
    cols: 10,
    blocks: [
      [0, 0, 10, 1, "wall", "Wall"],
      [0, 7, 7, 1, "wall", "Wall"],
      [7, 7, 3, 1, "door", "Door"],
      [1, 1, 4, 2, "counter", "Desk"],
      [6, 1, 3, 2, "shelf", "Bookshelf"],
      [1, 4, 3, 2, "cabinet", "Filing Cabinet"],
      [5, 4, 4, 2, "shelf", "Supplies"],
    ],
  },
  {
    id: "tpl-bathroom-storage",
    name: "Bathroom Storage",
    description: "Medicine cabinet, towel shelf and under-sink storage.",
    tags: ["bathroom", "home"],
    rows: 8,
    cols: 8,
    blocks: [
      [0, 0, 8, 1, "wall", "Wall"],
      [0, 7, 5, 1, "wall", "Wall"],
      [5, 7, 3, 1, "door", "Door"],
      [1, 1, 3, 2, "cabinet", "Medicine Cabinet"],
      [5, 1, 2, 2, "shelf", "Towels"],
      [1, 4, 2, 2, "zone", "Under Sink"],
      [4, 4, 3, 2, "shelf", "Toiletries"],
    ],
  },
];

const SYSTEM_USER = "system";
const nowSeconds = Math.floor(Date.now() / 1000);

let created = 0;
let skipped = 0;

for (const t of TEMPLATES) {
  const existing = await client.execute({
    sql: "SELECT id FROM templates WHERE id = ?",
    args: [t.id],
  });
  if (existing.rows.length) {
    skipped++;
    continue;
  }

  await client.execute({
    sql: `INSERT INTO templates
            (id, name, description, tags, rows, cols, user_id, is_public, usage_count, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
    args: [
      t.id,
      t.name,
      t.description,
      JSON.stringify(t.tags),
      t.rows,
      t.cols,
      SYSTEM_USER,
      nowSeconds,
    ],
  });

  const stmts = t.blocks.map(([x, y, w, h, key, label], i) => {
    const s = S[key];
    return {
      sql: `INSERT INTO template_blocks
              (block_id, template_id, background, border, label, height, width, x, y, kind)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [`${t.id}-${i}`, t.id, s.bg, s.border, label, h, w, x, y, s.kind],
    };
  });
  await client.batch(stmts, "write");
  created++;
}

console.log(`Templates seeded — created: ${created}, skipped (existing): ${skipped}`);
