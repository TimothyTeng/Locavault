// Shared shapes for the recipes module (DESIGN.md §7). A recipe ingredient is a
// canonical name plus an optional structured measurement (amount + unit); the
// unit is one of the keys in `app/utils/helpers/units.ts`. Steps are ordered
// instructions, each with an optional image URL. These are the JSON shapes stored
// in the `recipes` table's `ingredients` / `steps` columns.

/** One recipe ingredient — a name, with an optional structured measurement. */
export type RecipeIngredient = {
  name: string;
  /** Quantity in `unit`, e.g. 2 for "2 tbsp". Omitted = "to taste" / unmeasured. */
  amount?: number;
  /** A unit key from `app/utils/helpers/units.ts` (tsp/tbsp/cup/ml/l/g/kg/…). */
  unit?: string;
};

/** One ordered preparation step. */
export type RecipeStep = {
  text: string;
  /** Optional per-step photo (a URL — no upload infra; see DESIGN.md §7). */
  imageUrl?: string;
};

// A user-saved recipe parsed from the DB is returned as the runtime `Recipe`
// shape (app/lib/recipes.ts) with `custom: true`, so it drops straight into the
// matcher, panel, and editor — no separate persistence type is needed.

/** A planned meal slot. */
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

/**
 * A recipe scheduled on a day (DESIGN.md §7 meal planning). Per-store. `recipeRef`
 * is a recipe id — a `ur_*` user recipe or a seeded id — so it's intentionally
 * NOT a FK; `recipeName` is denormalised so the entry still reads if the recipe
 * is later deleted. `dateKey` is a local "YYYY-MM-DD" (date-only, no timezone
 * drift for a calendar).
 */
export type ScheduledMeal = {
  id: string;
  storeId: string;
  recipeRef: string;
  recipeName: string;
  dateKey: string;
  mealType: MealType;
  createdAt: number | null;
};

/**
 * One scheduled meal's shopping need: the day it's planned for and the pretty
 * ingredient names that meal's recipe calls for but the store is out of. The
 * shopping list's "Upcoming" tab unions these across a chosen timeframe.
 */
export type MealNeed = { dateKey: string; names: string[] };
