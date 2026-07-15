import type { Item } from "~/types/storeTypes";
import type { RecipeIngredient } from "~/types/recipeTypes";
import { RECIPES, type Recipe } from "~/lib/recipes";
import { hasTrait } from "~/lib/itemTypes";
import { expiryDateRemainingDays } from "./store.helper";

// Recipe ↔ pantry matching. Deliberately fuzzy and lenient: we match against
// "what you typically keep" (DESIGN.md §7), never exact quantities. A recipe
// ingredient is "have" if any in-stock pantry item shares a significant word
// with it (e.g. "onion" matches "Red Onions", "olive oil" matches "Olive Oil").

/** Soft expiry horizon (days) for the "use it up" emphasis. */
export const USE_IT_UP_DAYS = 30;

const STOPWORDS = new Set([
  "of",
  "the",
  "a",
  "an",
  "and",
  "with",
  "in",
  "fresh",
  "dried",
  "ground",
  "large",
  "small",
  "medium",
  "ripe",
  "whole",
  "raw",
  "cooked",
  "frozen",
  "organic",
  "free",
  "range",
  "pack",
  "bag",
  "box",
  "tin",
  "can",
  "jar",
  "bottle",
  "extra",
  "virgin",
  "low",
  "fat",
  "light",
  "plain",
  "sauce",
]);

/**
 * Lowercase, de-pluralise, drop noise words → significant tokens. Keeps
 * alphanumeric tokens whole so grades/strengths survive ("2%" → "milk" only,
 * but "B12" stays "b12" and "omega3" stays intact) instead of being shredded.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, ""))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * An ingredient is satisfied only when *all* of its significant tokens are in the
 * pantry — so "coconut milk" needs coconut, not just any milk. A bare "milk"
 * (single token) still matches a "Milk" item; it's the modifiers that must line
 * up, which stops a qualified variant from being satisfied by the head noun alone.
 */
function ingredientInPantry(ingredient: string, pantry: Set<string>): boolean {
  const toks = tokenize(ingredient);
  return toks.length > 0 && toks.every((t) => pantry.has(t));
}

/** Per-ingredient match detail — drives the detail view, map link, decrement. */
export type IngredientStatus = {
  ingredient: RecipeIngredient;
  inStock: boolean;
  /** In-stock items that satisfy this ingredient (for "on shelf B3" + decrement). */
  items: Item[];
  /** Any matched item is expiring soon — the "use it up" hook. */
  expiring: boolean;
};

export type RecipeMatch = {
  recipe: Recipe;
  /** Ordered per-ingredient detail (same order as `recipe.ingredients`). */
  ingredients: IngredientStatus[];
  /** Ingredient names in stock (kept for the compact card display). */
  have: string[];
  missing: string[];
  /** Ingredient names matched to an item that's expiring soon. */
  usesExpiring: string[];
  total: number;
  haveCount: number;
  /** missing.length === 0 — everything's on hand. */
  cookable: boolean;
};

/**
 * Score recipes against the store's edible inventory and return them ranked:
 * recipes that use up expiring items first, then the most-cookable, then the
 * closest "almost". Recipes with zero matching ingredients are dropped — the
 * panel only shows what's relevant to this pantry.
 *
 * `extra` recipes (the user's saved library) are folded in ahead of the seeded
 * set so they win ties.
 */
export function matchRecipes(
  items: Item[],
  extra: Recipe[] = [],
): RecipeMatch[] {
  // Pantry = in-stock items (lean on the `edible` trait, but fall back to all
  // named items so an untyped "Rice" still counts).
  const inStock = items.filter((i) => i.quantity > 0);
  const edible = inStock.filter((i) =>
    hasTrait(i.itemType ?? "other", "edible"),
  );
  const pantrySource = edible.length ? edible : inStock;

  // Index pantry tokens → items so an ingredient resolves back to the actual
  // item(s) (and their blocks) it matched, not just a yes/no.
  const pantryTokens = new Set<string>();
  const itemsByToken = new Map<string, Item[]>();
  const expiringItemIds = new Set<string>();
  for (const item of pantrySource) {
    const toks = tokenize(item.name);
    toks.forEach((t) => {
      pantryTokens.add(t);
      const arr = itemsByToken.get(t);
      if (arr) arr.push(item);
      else itemsByToken.set(t, [item]);
    });
    const days = expiryDateRemainingDays(item.expiryDate);
    if (days != null && days <= USE_IT_UP_DAYS) expiringItemIds.add(item.id);
  }

  /** Resolve an ingredient to the in-stock items that satisfy it (deduped). */
  const itemsForIngredient = (ing: RecipeIngredient): Item[] => {
    const seen = new Set<string>();
    const out: Item[] = [];
    for (const t of tokenize(ing.name)) {
      for (const it of itemsByToken.get(t) ?? []) {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          out.push(it);
        }
      }
    }
    return out;
  };

  const matches: RecipeMatch[] = [];
  for (const recipe of [...extra, ...RECIPES]) {
    const ingredients: IngredientStatus[] = [];
    const have: string[] = [];
    const missing: string[] = [];
    const usesExpiring: string[] = [];
    for (const ing of recipe.ingredients) {
      const inStock = ingredientInPantry(ing.name, pantryTokens);
      const matchedItems = inStock ? itemsForIngredient(ing) : [];
      const expiring = matchedItems.some((it) => expiringItemIds.has(it.id));
      ingredients.push({
        ingredient: ing,
        inStock,
        items: matchedItems,
        expiring,
      });
      if (inStock) {
        have.push(ing.name);
        if (expiring) usesExpiring.push(ing.name);
      } else {
        missing.push(ing.name);
      }
    }
    if (have.length === 0) continue; // nothing relevant — skip
    matches.push({
      recipe,
      ingredients,
      have,
      missing,
      usesExpiring,
      total: recipe.ingredients.length,
      haveCount: have.length,
      cookable: missing.length === 0,
    });
  }

  return matches.sort((a, b) => {
    if (b.usesExpiring.length !== a.usesExpiring.length)
      return b.usesExpiring.length - a.usesExpiring.length;
    if (a.missing.length !== b.missing.length)
      return a.missing.length - b.missing.length;
    return b.haveCount - a.haveCount;
  });
}

/** Title-case an ingredient for display / shopping-list entry. */
export function prettyIngredient(ing: string): string {
  return ing.replace(/\b\w/g, (c) => c.toUpperCase());
}
