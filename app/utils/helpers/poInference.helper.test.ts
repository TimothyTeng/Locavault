import { describe, it, expect } from "vitest";
import {
  inferTypeFromName,
  matchExistingItem,
  inferBlockId,
  inferPOFields,
  inferItemFields,
  buildTypeConsensus,
  computeConsensus,
  canonicalNameKey,
  matchCrowdType,
  type TypeVote,
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

  it("forgives a single typo on longer tokens", () => {
    const pantry = [
      mkItem({ id: "yog", name: "Greek Yoghurt" }),
      mkItem({ id: "tom", name: "Tinned Tomatoes" }),
    ];
    expect(matchExistingItem("yogurt", pantry)?.id).toBe("yog"); // yoghurt↔yogurt
    expect(matchExistingItem("tomatoe", pantry)?.id).toBe("tom");
  });

  it("does not collapse distinct short words via typo tolerance", () => {
    const pantry = [mkItem({ id: "tea", name: "Green Tea" })];
    expect(matchExistingItem("pea", pantry)).toBeNull();
  });

  it("keeps alphanumeric grades as tokens (B12 vitamins)", () => {
    const pantry = [mkItem({ id: "b12", name: "Vitamin B12" })];
    expect(matchExistingItem("b12", pantry)?.id).toBe("b12");
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

  it("inferItemFields mirrors the PO chain for item capture (no packageSize)", () => {
    const items = [
      mkItem({ id: "milk", name: "Whole Milk", itemType: "food", unit: "l" }),
    ];
    // Fuzzy-matches the existing item → links it for restock + inherits type.
    const restock = inferItemFields("milk", items, blocks);
    expect(restock.matchedItemId).toBe("milk");
    expect(restock.itemType).toBe("food");
    expect("packageSize" in restock).toBe(false);
    // A fresh name still resolves a type + a real shelf.
    const fresh = inferItemFields("Bananas", [], blocks);
    expect(fresh.itemType).toBe("food");
    expect(fresh.blockId).not.toBeNull();
    expect(fresh.matchedItemId).toBeNull();
  });

  it("resolves a location for recipe/gap-sourced names with no matching item", () => {
    // Rows added from a recipe's missing ingredients, the calendar's Upcoming
    // tab, or a collection's gaps all flow through inferPOFields, so they must
    // land on a real shelf (never blockId: null) even with nothing in stock.
    for (const name of ["Onion", "Garlic", "Chicken Stock", "Paprika"]) {
      const r = inferPOFields(name, [], blocks);
      expect(r.blockId).not.toBeNull();
    }
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

  it("falls to the crowd consensus for a name the lexicon doesn't know", () => {
    // "Widget 3000" isn't in the lexicon; the crowd has filed "widget" as equipment
    // (crowd keys are canonical token keys — the "3000" is dropped as non-letter).
    const crowd = { widget: "equipment" as const };
    const r = inferPOFields("Widget 3000", [], blocks, {}, crowd);
    expect(r.itemType).toBe("equipment");
  });

  it("keeps the curated lexicon guess over a conflicting crowd hint", () => {
    // The lexicon knows "Bananas" is food; a stray crowd vote can't override it.
    const crowd = { banana: "supplies" as const };
    const r = inferPOFields("Bananas", [], blocks, {}, crowd);
    expect(r.itemType).toBe("food");
  });

  it("lets the user's own memory win over the crowd", () => {
    const hints = { "widget 3000": "clothing" as const };
    const crowd = { widget: "equipment" as const };
    const r = inferPOFields("Widget 3000", [], blocks, hints, crowd);
    expect(r.itemType).toBe("clothing");
  });

  it("generalises a crowd bucket to a more specific typed name", () => {
    // The crowd knows "chicken" is food; typing "Chicken Thigh" still resolves.
    const crowd = { chicken: "food" as const };
    const r = inferPOFields("Chicken Thigh", [], blocks, {}, crowd);
    expect(r.itemType).toBe("food");
  });
});

describe("buildTypeConsensus", () => {
  const vote = (name: string, itemType: TypeVote["itemType"], userId: string) =>
    ({ name, itemType, userId }) as TypeVote;

  it("agrees when enough distinct users file a name the same way", () => {
    const rows = ["u1", "u2", "u3", "u4", "u5"].map((u) =>
      vote("Kombucha", "food", u),
    );
    expect(buildTypeConsensus(rows)).toEqual({ kombucha: "food" });
  });

  it("hides a name below the k-anonymity threshold", () => {
    // Only 3 distinct users — never surfaces, so a rare/personal name can't leak.
    const rows = ["u1", "u2", "u3"].map((u) => vote("Escargot", "food", u));
    expect(buildTypeConsensus(rows)).toEqual({});
  });

  it("counts distinct users, not rows (one prolific user can't reach quorum)", () => {
    // u1 has ten "Gadget" rows — still one person, below the threshold.
    const rows = Array.from({ length: 10 }, () =>
      vote("Gadget", "equipment", "u1"),
    );
    expect(buildTypeConsensus(rows)).toEqual({});
  });

  it("drops an ambiguous name with no clear majority", () => {
    const rows = [
      ...["u1", "u2", "u3"].map((u) => vote("Toy", "equipment", u)),
      ...["u4", "u5", "u6"].map((u) => vote("Toy", "clothing", u)),
    ];
    // 3/6 = 50% for each — below the 60% consensus gate.
    expect(buildTypeConsensus(rows)).toEqual({});
  });

  it("ignores 'other' votes entirely", () => {
    const rows = ["u1", "u2", "u3", "u4", "u5"].map((u) =>
      vote("Gizmo", "other", u),
    );
    expect(buildTypeConsensus(rows)).toEqual({});
  });

  it("excludes a given user's votes (can drop a name below quorum)", () => {
    const rows = ["u1", "u2", "u3", "u4", "u5"].map((u) =>
      vote("Kefir", "food", u),
    );
    // Without exclusion it's a consensus; excluding one drops it to 4 → gone.
    expect(buildTypeConsensus(rows)).toEqual({ kefir: "food" });
    expect(buildTypeConsensus(rows, { excludeUserId: "u1" })).toEqual({});
  });

  it("respects custom thresholds", () => {
    const rows = ["u1", "u2"].map((u) => vote("Yuzu", "food", u));
    expect(buildTypeConsensus(rows, { minUsers: 2 })).toEqual({ yuzu: "food" });
  });

  it("merges casing/order/modifier variants into one canonical bucket", () => {
    // Five different spellings of the same thing — all canonicalise to "milk",
    // so together they clear the threshold instead of splitting five ways.
    const rows = [
      vote("Whole Milk", "food", "u1"),
      vote("whole milk", "food", "u2"),
      vote("Organic Milk", "food", "u3"),
      vote("MILK", "food", "u4"),
      vote("milk 2%", "food", "u5"),
    ];
    expect(buildTypeConsensus(rows)).toEqual({ milk: "food" });
  });
});

describe("computeConsensus", () => {
  const vote = (name: string, itemType: TypeVote["itemType"], userId: string) =>
    ({ name, itemType, userId }) as TypeVote;

  it("returns surviving buckets with their distinct-user counts", () => {
    const rows = [
      ...["u1", "u2", "u3", "u4"].map((u) => vote("Kimchi", "food", u)),
      vote("Kimchi", "supplies", "u5"), // one dissenter
    ];
    const out = computeConsensus(rows);
    expect(out).toEqual([
      { name: "kimchi", itemType: "food", userCount: 4, totalUsers: 5 },
    ]);
  });

  it("is the source `buildTypeConsensus` reduces to a map", () => {
    const rows = ["u1", "u2", "u3", "u4", "u5"].map((u) =>
      vote("Kimchi", "food", u),
    );
    const detailed = computeConsensus(rows);
    const map = buildTypeConsensus(rows);
    expect(map).toEqual(
      Object.fromEntries(detailed.map((c) => [c.name, c.itemType])),
    );
  });
});

describe("canonicalNameKey", () => {
  it("drops modifiers/casing and keys to the significant token", () => {
    expect(canonicalNameKey("Whole Milk")).toBe("milk");
    expect(canonicalNameKey("Organic Milk")).toBe("milk");
    expect(canonicalNameKey("MILK")).toBe("milk");
    expect(canonicalNameKey("milk 2%")).toBe("milk");
  });

  it("sorts and dedupes multi-token names (order-independent)", () => {
    expect(canonicalNameKey("Peanut Butter")).toBe("butter peanut");
    expect(canonicalNameKey("Butter Peanut")).toBe("butter peanut");
  });

  it("is empty when nothing significant remains", () => {
    expect(canonicalNameKey("of the")).toBe("");
  });
});

describe("matchCrowdType", () => {
  it("hits exactly on the canonical key across variants", () => {
    const crowd = { milk: "food" as const };
    expect(matchCrowdType("Whole Milk", crowd)).toBe("food");
    expect(matchCrowdType("milk 2%", crowd)).toBe("food");
  });

  it("generalises a broad bucket to a more specific name", () => {
    expect(matchCrowdType("Chicken Thigh", { chicken: "food" })).toBe("food");
  });

  it("prefers the most specific matching bucket", () => {
    const crowd = { milk: "food" as const, "butter milk": "supplies" as const };
    expect(matchCrowdType("Butter Milk Drink", crowd)).toBe("supplies");
  });

  it("won't let a specific bucket hijack a broader name", () => {
    // "chicken thigh" bucket must NOT answer a bare "chicken".
    expect(matchCrowdType("Chicken", { "chicken thigh": "food" })).toBeNull();
  });

  it("returns null with no token overlap", () => {
    expect(matchCrowdType("Bleach", { milk: "food" })).toBeNull();
  });
});
