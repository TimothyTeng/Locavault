import { describe, it, expect } from "vitest";
import { formatMoney, basketTotal, spentCents } from "./money.helper";

describe("formatMoney", () => {
  it("formats cents as dollars", () => {
    expect(formatMoney(1234)).toBe("$12.34");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(5)).toBe("$0.05");
  });
  it("renders null as an em dash", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });
  it("handles negatives", () => {
    expect(formatMoney(-250)).toBe("-$2.50");
  });
});

describe("basketTotal", () => {
  it("sums cost × quantity in cents, counting priced/unpriced rows", () => {
    const r = basketTotal([
      { cost: 100, quantity: 2 }, // $2.00
      { cost: 50, quantity: 3 }, // $1.50
      { cost: null, quantity: 5 }, // no price
    ]);
    expect(r.cents).toBe(350);
    expect(r.priced).toBe(2);
    expect(r.unpriced).toBe(1);
  });
  it("is zero for an empty basket", () => {
    expect(basketTotal([])).toEqual({ cents: 0, priced: 0, unpriced: 0 });
  });
  it("ignores negative quantities", () => {
    expect(basketTotal([{ cost: 100, quantity: -3 }]).cents).toBe(0);
  });
});

describe("spentCents", () => {
  const cost = new Map<string, number | null>([
    ["a", 200],
    ["b", null],
    ["c", 50],
  ]);
  it("values restocks (positive deltas) at item cost", () => {
    const logs = [
      { itemId: "a", delta: 2 }, // 400
      { itemId: "c", delta: 3 }, // 150
    ];
    expect(spentCents(logs, cost)).toBe(550);
  });
  it("ignores consumption, confirmations, and unpriced items", () => {
    const logs = [
      { itemId: "a", delta: -1 }, // consumption
      { itemId: "a", delta: 0 }, // confirmation
      { itemId: "b", delta: 4 }, // no cost
    ];
    expect(spentCents(logs, cost)).toBe(0);
  });
});
