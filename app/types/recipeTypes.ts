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
