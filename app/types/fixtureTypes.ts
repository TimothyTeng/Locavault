/**
 * Fixtures give a block "character" — it renders as a recognisable top-down
 * pixel sprite (shelf, fridge, bed…) tinted by the block's colour. `null`
 * fixture = a plain coloured block (the original look). See DESIGN.md §5 / editor.
 */
export const FIXTURE_IDS = [
  // storage
  "shelf",
  "bookshelf",
  "cabinet",
  "pantry",
  "drawers",
  "wardrobe",
  "nightstand",
  "rack",
  "bin",
  // surfaces
  "counter",
  "table",
  "desk",
  // kitchen / laundry appliances
  "fridge",
  "freezer",
  "stove",
  "sink",
  "washer",
  // living / bed / bath
  "sofa",
  "bed",
  "bathtub",
  "toilet",
  "plant",
] as const;

export type FixtureId = (typeof FIXTURE_IDS)[number];

/**
 * How a fixture fills a block that spans multiple cells:
 * - `tile`   — repeat the sprite seamlessly across every cell (shelving runs,
 *              cabinet banks, counters). Grid-aligned, never stretched.
 * - `single` — one sprite at true 1-cell scale, centred on the colour zone
 *              (discrete appliances: a fridge stays fridge-sized in a big block).
 * - `fit`    — one sprite scaled (aspect preserved) to fill the whole footprint
 *              (large furniture: a bed/table fills the block you drew for it).
 */
export type FixtureFill = "tile" | "single" | "fit";
