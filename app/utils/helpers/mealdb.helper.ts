// Map TheMealDB's response into our recipe shapes (DESIGN.md §7). TheMealDB is a
// free, no-key public recipe API; `search.php?s=` already returns full meals, so
// one call gives everything we need to pre-fill the editor. Pure (no network) so
// it's unit-testable — the route (api.recipe-search.ts) does the fetch.

import type { RecipeIngredient, RecipeStep } from "~/types/recipeTypes";
import type { ImportedRecipe } from "./recipeImport.helper";
import { parseMeasure } from "./recipeImport.helper";

/** A raw TheMealDB meal — every field is a string or null. */
export type MealDbMeal = Record<string, string | null | undefined>;

/** A search hit: the importable recipe plus a few list-display fields. */
export type RecipeSearchResult = ImportedRecipe & {
  id: string;
  category?: string;
  area?: string;
};

/** Split TheMealDB's instruction blob into ordered steps. */
function splitInstructions(raw: string): RecipeStep[] {
  return raw
    .split(/\r?\n+/)
    .map((s) => s.replace(/^\s*(?:step\s*\d+[:.)]?|\d+[:.)])\s*/i, "").trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

/** Pull a "Ready in: 45 min" / "Cook: 30min" hint out of the instructions. */
function minutesFromText(raw: string): number | undefined {
  const ready = raw.match(/ready in[:\s]*?(\d+)\s*min/i);
  if (ready) return Number(ready[1]);
  let total = 0;
  for (const m of raw.matchAll(/(?:prep|cook)[:\s]*?(\d+)\s*min/gi))
    total += Number(m[1]);
  return total > 0 ? total : undefined;
}

/** Map one TheMealDB meal to an importable recipe. */
export function mealToImported(meal: MealDbMeal): RecipeSearchResult {
  const name = (meal.strMeal ?? "").trim();

  const ingredients: RecipeIngredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const ing = (meal[`strIngredient${i}`] ?? "").trim();
    if (!ing) continue;
    const measure = (meal[`strMeasure${i}`] ?? "").trim();
    const { amount, unit } = parseMeasure(measure);
    const row: RecipeIngredient = { name: ing.toLowerCase() };
    if (amount != null) row.amount = amount;
    if (unit) row.unit = unit;
    ingredients.push(row);
  }

  const instructions = meal.strInstructions ?? "";
  const steps = splitInstructions(instructions);

  // Tags: TheMealDB's comma list + area/category, deduped + lowercased.
  const tagSet = new Set<string>();
  for (const t of (meal.strTags ?? "").split(","))
    if (t.trim()) tagSet.add(t.trim().toLowerCase());
  if (meal.strArea) tagSet.add(meal.strArea.trim().toLowerCase());
  if (meal.strCategory) tagSet.add(meal.strCategory.trim().toLowerCase());

  const out: RecipeSearchResult = {
    id: (meal.idMeal ?? name).trim(),
    name,
    ingredients,
    steps,
    tags: [...tagSet],
  };
  if (meal.strMealThumb) out.imageUrl = meal.strMealThumb;
  if (meal.strSource && /^https?:\/\//i.test(meal.strSource))
    out.sourceUrl = meal.strSource;
  const minutes = minutesFromText(instructions);
  if (minutes) out.minutes = minutes;
  if (meal.strCategory) out.category = meal.strCategory.trim();
  if (meal.strArea) out.area = meal.strArea.trim();
  return out;
}

/** Map a TheMealDB `meals` array (or null) to search results, named entries only. */
export function mealsToResults(
  meals: MealDbMeal[] | null,
): RecipeSearchResult[] {
  if (!Array.isArray(meals)) return [];
  return meals.map(mealToImported).filter((r) => r.name);
}
