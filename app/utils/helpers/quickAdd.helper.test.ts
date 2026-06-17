import { describe, it, expect } from "vitest";
import { parseQuickAdd } from "./quickAdd.helper";

describe("parseQuickAdd", () => {
  it("defaults quantity to 1", () => {
    expect(parseQuickAdd("Milk")).toEqual([{ name: "Milk", quantity: 1 }]);
  });

  it("parses 'x2' style multipliers (x, ×, *)", () => {
    expect(parseQuickAdd("Milk x2")).toEqual([{ name: "Milk", quantity: 2 }]);
    expect(parseQuickAdd("Milk ×3")).toEqual([{ name: "Milk", quantity: 3 }]);
    expect(parseQuickAdd("Milk *4")).toEqual([{ name: "Milk", quantity: 4 }]);
  });

  it("parses trailing numbers, with or without a comma", () => {
    expect(parseQuickAdd("Eggs 12")).toEqual([{ name: "Eggs", quantity: 12 }]);
    expect(parseQuickAdd("Eggs, 12")).toEqual([{ name: "Eggs", quantity: 12 }]);
  });

  it("parses leading-quantity forms", () => {
    expect(parseQuickAdd("2 Milk")).toEqual([{ name: "Milk", quantity: 2 }]);
    expect(parseQuickAdd("2x Milk")).toEqual([{ name: "Milk", quantity: 2 }]);
  });

  it("handles multiple lines and skips blanks", () => {
    expect(parseQuickAdd("Milk x2\n\n  Eggs 12  \nPasta")).toEqual([
      { name: "Milk", quantity: 2 },
      { name: "Eggs", quantity: 12 },
      { name: "Pasta", quantity: 1 },
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseQuickAdd("")).toEqual([]);
    expect(parseQuickAdd("   \n  ")).toEqual([]);
  });

  it("never returns a quantity below 1", () => {
    const out = parseQuickAdd("Milk x0");
    expect(out[0].quantity).toBeGreaterThanOrEqual(1);
  });
});
