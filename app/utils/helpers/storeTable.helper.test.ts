import { describe, it, expect } from "vitest";
import { getItemStatus } from "./storeTable.helper";
import type { Item, UsageEstimate } from "~/types/storeTypes";
import type { ItemType } from "~/types/itemTypeTypes";

function makeItem(
  itemType: ItemType,
  runoutDays: number,
  over: Partial<Item> = {},
): Item {
  const usage: UsageEstimate = {
    dailyRate: 1,
    source: "history",
    confidence: "high",
    runoutDays,
    runoutDate: null,
    runoutEarly: runoutDays,
    runoutLate: runoutDays,
    bucket: "later",
    events: 5,
    windowDays: 30,
  };
  return {
    id: "i1",
    name: "x",
    quantity: 5,
    description: null,
    storeId: "s1",
    blockId: null,
    createdAt: null,
    isPublic: false,
    itemType,
    sku: null,
    unit: null,
    minQuantity: null,
    cost: null,
    expiryDate: null,
    useRate: null,
    useRatePeriod: null,
    usage,
    ...over,
  };
}

describe("getItemStatus — per-type run-out thresholds", () => {
  it("medication trips 'low' with more days of lead time than food", () => {
    // 10 days of stock: past food's 7d threshold (ok) but inside medication's 14d.
    expect(getItemStatus(makeItem("food", 10))).toBe("ok");
    expect(getItemStatus(makeItem("medication", 10))).toBe("low");
  });

  it("documents get a generous 30d threshold", () => {
    expect(getItemStatus(makeItem("document", 20))).toBe("low");
    expect(getItemStatus(makeItem("food", 20))).toBe("ok");
  });

  it("out and min-quantity still take precedence", () => {
    expect(getItemStatus(makeItem("food", 40, { quantity: 0 }))).toBe("out");
    expect(
      getItemStatus(makeItem("food", 40, { quantity: 1, minQuantity: 2 })),
    ).toBe("low");
  });
});
