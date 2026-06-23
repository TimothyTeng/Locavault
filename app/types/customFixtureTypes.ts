import type { FixtureCategory } from "./fixtureTypes";

/**
 * User-authored ("custom") fixtures — drawn in the freeform shape editor and
 * usable on blocks like the built-ins. See DESIGN.md §5.
 *
 * Storage is **colour-relative**: each shape names a `tone`, resolved to concrete
 * colours from the *block's* colour at render time (so a custom fixture recolours
 * per block, exactly like the built-ins). Coordinates live in a normalised 0–100
 * design box on both axes, so the fixture scales to any block footprint.
 */

/** Per-shape fill tone (resolved from the block colour in `FixtureGraphic`). */
export type ShapeTone = "outline" | "body" | "light" | "mid";

export const SHAPE_TONES: ShapeTone[] = ["outline", "body", "light", "mid"];

/** A base shape in a custom fixture. `w`/`h` are the bounding box; a `circle`
 *  renders as an ellipse inscribed in it, a `bar` is just a rounded rect. */
export type CustomShape = {
  type: "rect" | "bar" | "circle";
  x: number;
  y: number;
  w: number;
  h: number;
  tone: ShapeTone;
};

/** The design box both axes are normalised to (editor + renderer share this). */
export const FIXTURE_BOX = 100;

/** A saved custom fixture — a named set of shapes owned by a user. */
export type CustomFixture = {
  id: string; // "cf_<uuid>"
  userId: string;
  name: string;
  category: FixtureCategory;
  defaultColor: string;
  shapes: CustomShape[];
  createdAt: number | null;
};

/** A block's fixture reference: a built-in `FixtureId` or a custom `cf_<id>`. */
export type FixtureRef = string;

/** Whether a fixture reference points at a user-authored custom fixture. */
export const isCustomFixtureRef = (
  ref: string | null | undefined,
): ref is string => !!ref && ref.startsWith("cf_");
