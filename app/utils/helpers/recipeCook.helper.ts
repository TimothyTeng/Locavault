// "Cooked this" → how much to subtract from an item's stock (DESIGN.md §7).
// Measurement-aware but deliberately lenient (quantity is an integer, and we
// "match what you keep, never exact"): convert into the item's unit when both
// sides carry a recognised unit, otherwise fall back to counts. Always integer,
// never negative.

import type { RecipeIngredient } from "~/types/recipeTypes";
import { convert, normalizeUnit } from "./units";

/**
 * Decrement for one cooked ingredient against one stock item.
 * - both measured + same dimension → convert the recipe amount into the item's
 *   unit (e.g. 2 tbsp → 30 ml off a millilitre-tracked item);
 * - neither measured → treat amounts as counts ("2 eggs" → −2);
 * - otherwise (mismatched/incompatible units) → a coarse 1-per-serving nudge.
 * Scaled by `servings` (the batch multiplier), rounded, clamped at ≥ 0.
 */
export function decrementForIngredient(
  ingredient: Pick<RecipeIngredient, "amount" | "unit">,
  itemUnit: string | null | undefined,
  servings = 1,
): number {
  const factor = servings > 0 ? servings : 1;
  const amount = (ingredient.amount ?? 1) * factor;
  const ingUnit = normalizeUnit(ingredient.unit);
  const itmUnit = normalizeUnit(itemUnit);

  if (ingUnit && itmUnit) {
    const converted = convert(amount, ingUnit, itmUnit);
    if (converted != null) return Math.max(0, Math.round(converted));
    return Math.max(0, Math.round(factor)); // incompatible dimensions
  }
  if (!ingUnit && !itmUnit) return Math.max(0, Math.round(amount)); // counts
  return Math.max(0, Math.round(factor)); // one measured, one not
}
