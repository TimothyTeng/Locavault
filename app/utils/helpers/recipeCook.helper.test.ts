import { describe, it, expect } from "vitest";
import { decrementForIngredient } from "./recipeCook.helper";

describe("decrementForIngredient", () => {
  it("converts a measured ingredient into the item's unit", () => {
    // 2 tbsp ≈ 29.6 ml off a millilitre-tracked item.
    expect(decrementForIngredient({ amount: 2, unit: "tbsp" }, "ml")).toBe(30);
    // same unit → straight subtraction
    expect(decrementForIngredient({ amount: 400, unit: "g" }, "g")).toBe(400);
  });

  it("treats both-unitless ingredients as counts", () => {
    expect(decrementForIngredient({ amount: 2 }, null)).toBe(2);
    expect(decrementForIngredient({ amount: 1, unit: "" }, "")).toBe(1);
    // no amount → assume one
    expect(decrementForIngredient({}, null)).toBe(1);
  });

  it("scales by servings", () => {
    expect(decrementForIngredient({ amount: 2 }, null, 3)).toBe(6);
    expect(decrementForIngredient({ amount: 100, unit: "g" }, "g", 2)).toBe(
      200,
    );
  });

  it("falls back to a coarse nudge for mismatched units", () => {
    // recipe in ml, item tracked as a count (e.g. bottles)
    expect(decrementForIngredient({ amount: 2, unit: "tbsp" }, null)).toBe(1);
    // incompatible dimensions (volume vs mass)
    expect(decrementForIngredient({ amount: 200, unit: "ml" }, "g", 2)).toBe(2);
  });

  it("never returns a negative amount", () => {
    expect(decrementForIngredient({ amount: -5 }, null)).toBe(0);
  });
});
