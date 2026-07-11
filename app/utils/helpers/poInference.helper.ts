// Best-guess metadata for a shopping-list (purchase-order) row from just its
// name + the store it lives in. This is the engine behind the "show-then-confirm"
// capture flow: the caller pre-fills these guesses on a fresh row and lets the
// user glance and adjust, so the plain name+quantity flow quietly produces rich
// items (type → traits → recipe matching + run-out prediction) and a location.
//
// Two signals, strongest first:
//   1. A fuzzy match to an item you ALREADY keep → inherit its type/location/unit
//      (and link, so buying restocks instead of duplicating). The predictive win.
//   2. The name itself → a keyword guess at the type, then a block whose label
//      fits that type (falling back to the first standard block so a row is
//      never locationless).

import type { Item } from "~/types/storeTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
import type { ItemType } from "~/types/itemTypeTypes";
import { inferTypeFromLabel } from "~/lib/itemTypes";
import { tokenize } from "./recipes.helper";

export type POInference = {
  itemType: ItemType;
  blockId: string | null;
  unit: string | null;
  packageSize: string | null;
  /** Set when the name resolved to an item already in the store (→ restock). */
  matchedItemId: string | null;
  // Inherited from a matched item so even an unlinked buy stays rich.
  minQuantity: number | null;
  useRate: number | null;
  useRatePeriod: "day" | "week" | "month" | null;
  cost: number | null;
};

// Common grocery / household terms → type. `inferTypeFromLabel` keys off zone
// LABELS (fridge, pantry, garage); item NAMES need their own lexicon. This is a
// best-effort first guess, not a database — anything unknown stays "other" and
// the user confirms. Order matters: more specific categories first.
const NAME_HINTS: { type: ItemType; re: RegExp }[] = [
  {
    type: "medication",
    re: /\b(ibuprofen|paracetamol|acetaminophen|aspirin|antibiotic|antacid|vitamin|supplement|cough|syrup|bandage|plaster|ointment|tablet|capsule|painkiller)\b/i,
  },
  {
    type: "supplies",
    re: /\b(detergent|soap|shampoo|conditioner|toothpaste|toothbrush|tissue|tissues|toilet\s*paper|paper\s*towel|kitchen\s*roll|sponge|bleach|cleaner|wipes|deodorant|razor|floss|napkin|trash\s*bag|bin\s*bag|foil|cling\s*film|battery|batteries)\b/i,
  },
  {
    type: "food",
    re: /\b(chicken|beef|pork|lamb|turkey|bacon|ham|sausage|fish|salmon|tuna|shrimp|prawn|egg|eggs|milk|cream|cheese|butter|yogurt|yoghurt|bread|breadcrumb|breadcrumbs|crumb|bun|bagel|rice|pasta|noodle|noodles|flour|sugar|salt|pepper|oil|vinegar|sauce|ketchup|mustard|mayo|honey|jam|cereal|oats|onion|onions|garlic|ginger|tomato|tomatoes|potato|potatoes|carrot|carrots|pepper|broccoli|spinach|lettuce|cabbage|cucumber|mushroom|apple|apples|banana|bananas|orange|oranges|lemon|lime|grape|grapes|berry|berries|strawberr|avocado|coffee|tea|juice|water|soda|beer|wine|chocolate|biscuit|cookie|cookies|crisps|chips|snack|yeast|stock|broth|bean|beans|lentil|chickpea|tofu|coconut|nut|nuts|spice|herb)\b/i,
  },
];

/** Best-guess type from a free-text item NAME, or null if nothing matches. */
export function inferTypeFromName(name: string): ItemType | null {
  if (!name) return null;
  for (const { type, re } of NAME_HINTS) if (re.test(name)) return type;
  // Fall back to the zone-label heuristic (catches e.g. "passport", "shampoo
  // bottle" patterns it shares), else unknown.
  return inferTypeFromLabel(name);
}

/** The standard (placeable) blocks, in map order. */
function standardBlocks(blocks: BlocksMap): [string, BlocksMap[string]][] {
  return Object.entries(blocks).filter(
    ([, b]) => b.kind === "standard" || b.kind === undefined,
  );
}

/**
 * Pick the standard block whose label best fits `itemType`; if none matches,
 * fall back to the first standard block so a row is never locationless. Returns
 * null only when the store has no standard blocks at all.
 */
export function inferBlockId(
  itemType: ItemType,
  blocks: BlocksMap,
): string | null {
  const standard = standardBlocks(blocks);
  if (!standard.length) return null;
  const byType = standard.find(
    ([, b]) => inferTypeFromLabel(b.label) === itemType,
  );
  return byType ? byType[0] : standard[0][0];
}

/**
 * Fuzzy-match a free-typed name to an existing store item by shared significant
 * tokens (reusing the recipe matcher's `tokenize`). Returns the best overlap, or
 * null. Used so "milk" the 2nd time resolves to the Milk you already track.
 */
export function matchExistingItem(name: string, items: Item[]): Item | null {
  const wanted = new Set(tokenize(name));
  if (!wanted.size) return null;
  let best: { item: Item; score: number } | null = null;
  for (const it of items) {
    const itToks = tokenize(it.name);
    if (!itToks.length) continue;
    const overlap = itToks.filter((t) => wanted.has(t)).length;
    if (!overlap) continue;
    // Reward shared tokens; lightly penalise size mismatch so a tight match
    // ("Milk" → "Milk") beats a loose one ("Milk" → "Milk Chocolate").
    const score = overlap * 100 - Math.abs(itToks.length - wanted.size);
    if (!best || score > best.score) best = { item: it, score };
  }
  return best?.item ?? null;
}

/**
 * Infer all shopping-row metadata from a name. Prefers inheriting from a matched
 * existing item; otherwise guesses the type from the name and shelves it to a
 * fitting block. Always resolves a location when the store has any standard block.
 */
export function inferPOFields(
  name: string,
  items: Item[],
  blocks: BlocksMap,
): POInference {
  const match = matchExistingItem(name, items);
  if (match) {
    // Prefer the matched item's type — but only if it's a concrete one. Lots of
    // older items predate type capture and sit at "other"; in that case defer to
    // the name lexicon so "Plain Flour" still reads as food.
    const matchType = match.itemType ?? "other";
    const type =
      matchType !== "other" ? matchType : (inferTypeFromName(name) ?? "other");
    return {
      itemType: type,
      blockId: match.blockId ?? inferBlockId(type, blocks),
      unit: match.unit ?? null,
      packageSize: null,
      matchedItemId: match.id,
      minQuantity: match.minQuantity ?? null,
      useRate: match.useRate ?? null,
      useRatePeriod: match.useRatePeriod ?? null,
      cost: match.cost ?? null,
    };
  }
  const itemType = inferTypeFromName(name) ?? "other";
  return {
    itemType,
    blockId: inferBlockId(itemType, blocks),
    unit: null,
    packageSize: null,
    matchedItemId: null,
    minQuantity: null,
    useRate: null,
    useRatePeriod: null,
    cost: null,
  };
}
