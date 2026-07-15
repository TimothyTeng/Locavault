import { describe, it, expect } from "vitest";
import { getItemStatus, itemNeedsDetails } from "./storeTable.helper";
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

  it("suppresses low/expiring while snoozed, but never hides 'out'", () => {
    const future = new Date(Date.now() + 3 * 86_400_000);
    const past = new Date(Date.now() - 86_400_000);
    // A would-be 'low' medication goes quiet while snoozed…
    expect(
      getItemStatus(makeItem("medication", 5, { alertSnoozedUntil: future })),
    ).toBe("ok");
    // …but a passed snooze re-alerts, and 'out' ignores the snooze entirely.
    expect(
      getItemStatus(makeItem("medication", 5, { alertSnoozedUntil: past })),
    ).toBe("low");
    expect(
      getItemStatus(
        makeItem("food", 5, { quantity: 0, alertSnoozedUntil: future }),
      ),
    ).toBe("out");
  });
});

describe("itemNeedsDetails", () => {
  it("flags a perishable item with no expiry", () => {
    expect(itemNeedsDetails(makeItem("food", 5, { expiryDate: null }))).toBe(
      true,
    );
    expect(
      itemNeedsDetails(
        makeItem("food", 5, { expiryDate: new Date(), minQuantity: 1 }),
      ),
    ).toBe(false);
  });
  it("flags a depleting item with no min-stock", () => {
    expect(
      itemNeedsDetails(
        makeItem("supplies", 5, { minQuantity: null, expiryDate: new Date() }),
      ),
    ).toBe(true);
  });
  it("ignores non-perishable/non-depleting types and out-of-stock items", () => {
    expect(itemNeedsDetails(makeItem("equipment", 5))).toBe(false);
    expect(itemNeedsDetails(makeItem("food", 0, { quantity: 0 }))).toBe(false);
  });
});
