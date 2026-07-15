// Cooking-unit registry + conversion (DESIGN.md §7). Recipe ingredients and
// measured items carry an amount + a unit key from here. Conversion works WITHIN
// a dimension only (volume↔volume, mass↔mass, count↔count) — cross-dimension
// (cups↔grams) needs per-ingredient density and is deliberately out of scope, so
// `convert` returns null there and callers fall back to a simple decrement.

export type UnitDimension = "volume" | "mass" | "count";

export type UnitDef = {
  dimension: UnitDimension;
  /** Factor to the dimension's base unit (ml for volume, g for mass, 1 for count). */
  base: number;
  /** Short display label. */
  label: string;
};

/** Canonical units, keyed by a lowercase code. `base` is in ml / g / count. */
export const UNITS: Record<string, UnitDef> = {
  // ── count ──
  pcs: { dimension: "count", base: 1, label: "pcs" },
  // ── volume (base = ml) ──
  tsp: { dimension: "volume", base: 4.92892, label: "tsp" },
  tbsp: { dimension: "volume", base: 14.7868, label: "tbsp" },
  cup: { dimension: "volume", base: 236.588, label: "cup" },
  floz: { dimension: "volume", base: 29.5735, label: "fl oz" },
  ml: { dimension: "volume", base: 1, label: "ml" },
  l: { dimension: "volume", base: 1000, label: "l" },
  // ── mass (base = g) ──
  g: { dimension: "mass", base: 1, label: "g" },
  kg: { dimension: "mass", base: 1000, label: "kg" },
  oz: { dimension: "mass", base: 28.3495, label: "oz" },
  lb: { dimension: "mass", base: 453.592, label: "lb" },
};

/** Options for a unit `<select>` (grouped by dimension, count first). */
export const UNIT_OPTIONS: { value: string; label: string }[] = Object.entries(
  UNITS,
).map(([value, def]) => ({ value, label: def.label }));

/** Many spellings → a canonical unit key (for the URL importer + free text). */
const ALIASES: Record<string, string> = {
  // count
  pcs: "pcs",
  piece: "pcs",
  pieces: "pcs",
  pc: "pcs",
  each: "pcs",
  ea: "pcs",
  unit: "pcs",
  units: "pcs",
  // volume
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  t: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbl: "tbsp",
  tbs: "tbsp",
  cup: "cup",
  cups: "cup",
  c: "cup",
  floz: "floz",
  "fl oz": "floz",
  "fluid ounce": "floz",
  "fluid ounces": "floz",
  ml: "ml",
  milliliter: "ml",
  millilitre: "ml",
  milliliters: "ml",
  millilitres: "ml",
  cc: "ml",
  l: "l",
  liter: "l",
  litre: "l",
  liters: "l",
  litres: "l",
  // mass
  g: "g",
  gram: "g",
  grams: "g",
  gr: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
};

/** Resolve a raw unit string to a canonical key, or undefined if unrecognised. */
export function normalizeUnit(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase().replace(/\.$/, "");
  if (UNITS[key]) return key;
  return ALIASES[key];
}

/**
 * Convert `amount` from one unit to another within the same dimension.
 * Returns null when either unit is unknown or they belong to different
 * dimensions (e.g. ml → g) — the caller decides how to fall back.
 */
export function convert(
  amount: number,
  from?: string | null,
  to?: string | null,
): number | null {
  const f = normalizeUnit(from);
  const t = normalizeUnit(to);
  if (!f || !t) return null;
  const fd = UNITS[f];
  const td = UNITS[t];
  if (fd.dimension !== td.dimension) return null;
  return (amount * fd.base) / td.base;
}

/** Trim a number to a tidy display string (drops trailing zeros). */
export function formatAmount(amount: number): string {
  if (!isFinite(amount)) return "";
  return Number(amount.toFixed(2)).toString();
}
