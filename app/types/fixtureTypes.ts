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
 * - `slice`  — drawn as ONE coherent object at the block's full size: fixed end
 *              caps / top & base, with the middle repeating or stretching (a
 *              9-slice). A 1×3 cabinet is one tall cabinet, not three stacked;
 *              a 3×1 counter is one run with end caps. The builder receives the
 *              block's pixel size. Used by shelving / cabinetry / counters.
 * - `single` — one sprite at true 1-cell scale, centred on the colour zone
 *              (discrete appliances: a fridge stays fridge-sized in a big block).
 * - `fit`    — one sprite scaled (aspect preserved) to fill the whole footprint
 *              (large furniture: a bed/table fills the block you drew for it).
 * - `tile`   — legacy: repeat the unit sprite per cell. Superseded by `slice`.
 */
export type FixtureFill = "slice" | "tile" | "single" | "fit";
