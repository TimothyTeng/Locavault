import type { Item } from "~/types/storeTypes";
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
  "of", "the", "a", "an", "and", "with", "in", "fresh", "dried", "ground",
  "large", "small", "medium", "ripe", "whole", "raw", "cooked", "frozen",
  "organic", "free", "range", "pack", "bag", "box", "tin", "can", "jar",
  "bottle", "extra", "virgin", "low", "fat", "light", "plain", "sauce",
]);

/** Lowercase, de-pluralise, drop noise words → significant tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, ""))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** An ingredient is satisfied if any of its tokens is in the pantry token set. */
function ingredientInPantry(ingredient: string, pantry: Set<string>): boolean {
  const toks = tokenize(ingredient);
  return toks.length > 0 && toks.some((t) => pantry.has(t));
}

export type RecipeMatch = {
  recipe: Recipe;
  have: string[];
  missing: string[];
  /** Ingredients matched to an item that's expiring soon — the "use it up" hook. */
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
 */
export function matchRecipes(items: Item[]): RecipeMatch[] {
  // Pantry = in-stock items (lean on the `edible` trait, but fall back to all
  // named items so an untyped "Rice" still counts).
  const inStock = items.filter((i) => i.quantity > 0);
  const edible = inStock.filter((i) => hasTrait(i.itemType ?? "other", "edible"));
  const pantrySource = edible.length ? edible : inStock;

  const pantryTokens = new Set<string>();
  const expiringTokens = new Set<string>();
  for (const item of pantrySource) {
    const toks = tokenize(item.name);
    toks.forEach((t) => pantryTokens.add(t));
    const days = expiryDateRemainingDays(item.expiryDate);
    if (days != null && days <= USE_IT_UP_DAYS) {
      toks.forEach((t) => expiringTokens.add(t));
    }
  }

  const matches: RecipeMatch[] = [];
  for (const recipe of RECIPES) {
    const have: string[] = [];
    const missing: string[] = [];
    const usesExpiring: string[] = [];
    for (const ing of recipe.ingredients) {
      if (ingredientInPantry(ing, pantryTokens)) {
        have.push(ing);
        if (ingredientInPantry(ing, expiringTokens)) usesExpiring.push(ing);
      } else {
        missing.push(ing);
      }
    }
    if (have.length === 0) continue; // nothing relevant — skip
    matches.push({
      recipe,
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
