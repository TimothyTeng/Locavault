import { describe, it, expect } from "vitest";
import { matchRecipes, prettyIngredient } from "./recipes.helper";
import type { Item } from "~/types/storeTypes";
import type { ItemType } from "~/types/itemTypeTypes";

// Minimal item factory — matchRecipes only reads name/quantity/itemType/expiry.
function item(
  name: string,
  opts: {
    quantity?: number;
    itemType?: ItemType;
    expiryDate?: Date | null;
  } = {},
): Item {
  return {
    id: name,
    name,
    quantity: opts.quantity ?? 1,
    storeId: "s",
    blockId: null,
    createdAt: new Date(),
    isPublic: true,
    itemType: opts.itemType ?? "food",
    sku: null,
    unit: null,
    minQuantity: null,
    cost: null,
    expiryDate: opts.expiryDate ?? null,
    useRate: null,
    useRatePeriod: null,
  } as unknown as Item;
}

describe("matchRecipes", () => {
  it("marks a recipe cookable when every ingredient is in stock", () => {
    const matches = matchRecipes([item("Eggs"), item("Butter"), item("Milk")]);
    const eggs = matches.find((m) => m.recipe.id === "scrambled-eggs");
    expect(eggs).toBeDefined();
    expect(eggs!.missing).toHaveLength(0);
    expect(eggs!.cookable).toBe(true);
  });

  it("does fuzzy, de-pluralised name matching", () => {
    // "Red Onions" should satisfy the "onion" ingredient.
    const matches = matchRecipes([
      item("Pasta"),
      item("Tinned Tomatoes"),
      item("Red Onions"),
      item("Garlic"),
      item("Olive Oil"),
    ]);
    const tomatoPasta = matches.find((m) => m.recipe.id === "tomato-pasta");
    expect(tomatoPasta?.cookable).toBe(true);
  });

  it("lists missing ingredients when not everything is on hand", () => {
    const matches = matchRecipes([item("Eggs"), item("Butter")]);
    const eggs = matches.find((m) => m.recipe.id === "scrambled-eggs");
    expect(eggs).toBeDefined();
    expect(eggs!.cookable).toBe(false);
    expect(eggs!.missing).toContain("milk");
  });

  it("ignores out-of-stock items", () => {
    const matches = matchRecipes([
      item("Eggs", { quantity: 0 }),
      item("Butter"),
      item("Milk"),
    ]);
    const eggs = matches.find((m) => m.recipe.id === "scrambled-eggs");
    expect(eggs!.missing).toContain("egg");
  });

  it("flags ingredients from items expiring soon (use-it-up)", () => {
    const soon = new Date(Date.now() + 3 * 86_400_000);
    const matches = matchRecipes([
      item("Eggs"),
      item("Butter"),
      item("Milk", { expiryDate: soon }),
    ]);
    const eggs = matches.find((m) => m.recipe.id === "scrambled-eggs");
    expect(eggs!.usesExpiring).toContain("milk");
  });

  it("excludes recipes with no matching ingredients", () => {
    expect(matchRecipes([item("Quinoa")])).toHaveLength(0);
  });

  it("sorts use-it-up and cookable recipes ahead", () => {
    const soon = new Date(Date.now() + 2 * 86_400_000);
    const matches = matchRecipes([
      item("Eggs", { expiryDate: soon }),
      item("Butter"),
      item("Milk"),
      item("Bread"),
    ]);
    // The first result should use an expiring item or be cookable.
    expect(matches[0].usesExpiring.length > 0 || matches[0].cookable).toBe(
      true,
    );
  });
});

describe("prettyIngredient", () => {
  it("title-cases ingredient names", () => {
    expect(prettyIngredient("olive oil")).toBe("Olive Oil");
    expect(prettyIngredient("egg")).toBe("Egg");
  });
});
