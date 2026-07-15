/**
 * Fixtures give a block "character" — it renders as a recognisable top-down
 * vector drawing (shelf, fridge, bed…) tinted by the block's colour. `null`
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
 * Which group a fixture sits in within the block picker (drives the categorised
 * gallery in `AddBlockModal`). Structural block kinds (room/divider/stairs) are a
 * separate axis — see `BlockKind` — so they're not a fixture category.
 */
export type FixtureCategory = "storage" | "furniture" | "appliance" | "object";

/**
 * How a fixture fills the block it occupies (the vector builder is recomputed at
 * the block's size — see `app/lib/fixtures.tsx`):
 * - `slice` / `fit` — fill the whole footprint. Fixed structure (frame, posts,
 *                     arms) plus a *modest, size-keyed* count of repeating parts
 *                     (shelves, doors, cushions), so a big block reads as ONE
 *                     object, not duplicated tiles. Used by shelving / cabinetry
 *                     / counters and by large furniture / appliances.
 * - `single`        — a small discrete object (bin, nightstand, toilet, plant):
 *                     drawn at a capped size and centred, so it doesn't smear to
 *                     fill a large block.
 * - `tile`          — legacy; no longer used by any fixture.
 */
export type FixtureFill = "slice" | "tile" | "single" | "fit";
