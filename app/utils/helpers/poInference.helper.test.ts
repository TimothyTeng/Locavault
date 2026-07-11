import { describe, it, expect } from "vitest";
import {
  inferTypeFromName,
  matchExistingItem,
  inferBlockId,
  inferPOFields,
} from "./poInference.helper";
import type { Item } from "~/types/storeTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";

const mkItem = (over: Partial<Item>): Item =>
  ({
    id: "i1",
    name: "Item",
    quantity: 1,
    description: null,
    storeId: "s1",
    blockId: null,
    createdAt: null,
    isPublic: true,
    itemType: "other",
    sku: null,
    unit: null,
    minQuantity: null,
    cost: null,
    expiryDate: null,
    useRate: null,
    useRatePeriod: null,
    checkedOut: false,
    forTrade: false,
    tradeNote: null,
    ...over,
  }) as Item;

const blk = (label: string, kind: BlocksMap[string]["kind"] = "standard") =>
  ({
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    bg: "#000",
    border: "#000",
    label,
    kind,
  }) as BlocksMap[string];

describe("inferTypeFromName", () => {
  it("guesses food from common grocery names", () => {
    expect(inferTypeFromName("Chicken breast")).toBe("food");
    expect(inferTypeFromName("Whole Milk")).toBe("food");
    expect(inferTypeFromName("Bananas")).toBe("food");
    expect(inferTypeFromName("Olive Oil")).toBe("food");
    expect(inferTypeFromName("Ground beef")).toBe("food");
  });

  it("matches plurals and space/hyphen variants automatically", () => {
    expect(inferTypeFromName("Carrots")).toBe("food");
    expect(inferTypeFromName("Strawberries")).toBe("food");
    expect(inferTypeFromName("Band-aid")).toBe("medication");
    expect(inferTypeFromName("Paper towels")).toBe("supplies");
  });

  it("guesses supplies and medication", () => {
    expect(inferTypeFromName("Dish detergent")).toBe("supplies");
    expect(inferTypeFromName("Ibuprofen 200mg")).toBe("medication");
  });

  it("guesses equipment, clothing and documents", () => {
    expect(inferTypeFromName("Frying pan")).toBe("equipment");
    expect(inferTypeFromName("Winter jacket")).toBe("clothing");
    expect(inferTypeFromName("Passport")).toBe("document");
  });

  it("resolves ambiguous terms by specificity/order", () => {
    // bare "syrup" must not be medication — "maple syrup" is food.
    expect(inferTypeFromName("Maple syrup")).toBe("food");
    // but a medication phrase still wins.
    expect(inferTypeFromName("Cough syrup")).toBe("medication");
  });

  it("returns null when nothing matches", () => {
    expect(inferTypeFromName("Widget 3000")).toBeNull();
  });
});

describe("matchExistingItem", () => {
  const items = [
    mkItem({ id: "milk", name: "Whole Milk" }),
    mkItem({ id: "choc", name: "Milk Chocolate" }),
    mkItem({ id: "rice", name: "Jasmine Rice" }),
  ];

  it("matches on shared significant tokens", () => {
    expect(matchExistingItem("rice", items)?.id).toBe("rice");
  });

  it("prefers the tighter match", () => {
    // "Milk" overlaps both, but the exact-size "Whole Milk" wins over the
    // looser "Milk Chocolate".
    expect(matchExistingItem("milk", items)?.id).toBe("milk");
  });

  it("returns null with no overlap", () => {
    expect(matchExistingItem("bleach", items)).toBeNull();
  });
});

describe("inferBlockId", () => {
  const blocks: BlocksMap = {
    b1: blk("Garage"),
    b2: blk("Fridge"),
    b3: blk("Stairs", "stairs"),
  };

  it("picks a block whose label fits the type", () => {
    expect(inferBlockId("food", blocks)).toBe("b2");
  });

  it("falls back to the first standard block (never a non-standard one)", () => {
    expect(inferBlockId("clothing", blocks)).toBe("b1");
  });

  it("returns null only when there are no standard blocks", () => {
    expect(inferBlockId("food", { s: blk("Stairs", "stairs") })).toBeNull();
  });
});

describe("inferPOFields", () => {
  const blocks: BlocksMap = { pantry: blk("Pantry"), garage: blk("Garage") };

  it("inherits from a matched existing item and links it", () => {
    const items = [
      mkItem({
        id: "milk",
        name: "Whole Milk",
        itemType: "food",
        blockId: "pantry",
        unit: "l",
        minQuantity: 1,
        useRate: 2,
        useRatePeriod: "week",
      }),
    ];
    const r = inferPOFields("milk", items, blocks);
    expect(r.matchedItemId).toBe("milk");
    expect(r.itemType).toBe("food");
    expect(r.blockId).toBe("pantry");
    expect(r.unit).toBe("l");
    expect(r.useRate).toBe(2);
  });

  it("defers to the name lexicon when a matched item is untyped", () => {
    // Old data: an existing "Plain Flour" item that predates type capture.
    const items = [
      mkItem({ id: "flour", name: "Plain Flour", itemType: "other" }),
    ];
    const r = inferPOFields("Plain Flour", items, blocks);
    expect(r.matchedItemId).toBe("flour"); // still links for restock
    expect(r.itemType).toBe("food"); // but type comes from the name, not "other"
  });

  it("guesses from the name and always resolves a location", () => {
    const r = inferPOFields("Bananas", [], blocks);
    expect(r.matchedItemId).toBeNull();
    expect(r.itemType).toBe("food");
    // food block (Pantry) preferred, else first standard — never null here.
    expect(r.blockId).toBe("pantry");
  });

  it("unknown name → other, but still gets a fallback location", () => {
    const r = inferPOFields("Widget 3000", [], blocks);
    expect(r.itemType).toBe("other");
    expect(r.blockId).toBe("pantry");
  });

  it("uses the user's remembered type for an otherwise-unknown name", () => {
    const hints = { "widget 3000": "equipment" as const };
    const r = inferPOFields("Widget 3000", [], blocks, hints);
    expect(r.itemType).toBe("equipment");
  });

  it("lets a remembered type override the lexicon guess", () => {
    // The user always files "Water" under supplies (e.g. distilled water for
    // an iron), not food — memory wins over the lexicon.
    const hints = { water: "supplies" as const };
    const r = inferPOFields("Water", [], blocks, hints);
    expect(r.itemType).toBe("supplies");
  });
});
