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

// Common household item NAMES → type. `inferTypeFromLabel` keys off zone LABELS
// (fridge, pantry, garage); item names need their own lexicon. Best-effort first
// guess only — anything unknown stays "other" for the user to confirm. Terms are
// singular stems: a trailing plural (s/es) and space/hyphen variants inside a
// phrase are matched automatically (so "band aid" also catches "band-aid"). Order
// = most specific first (health/cleaning before the broad food list).
const TYPE_TERMS: { type: ItemType; terms: string[] }[] = [
  {
    type: "medication",
    terms: [
      "ibuprofen",
      "paracetamol",
      "acetaminophen",
      "aspirin",
      "antibiotic",
      "antacid",
      "antihistamine",
      "painkiller",
      "vitamin",
      "supplement",
      "probiotic",
      "melatonin",
      "insulin",
      "inhaler",
      "cough syrup",
      "cough drop",
      "lozenge",
      "bandage",
      "band aid",
      "plaster",
      "gauze",
      "antiseptic",
      "ointment",
      "tablet",
      "capsule",
      "pill",
      "medicine",
      "medication",
      "eye drop",
      "nasal spray",
      "decongestant",
      "first aid",
    ],
  },
  {
    type: "supplies",
    terms: [
      "detergent",
      "dish soap",
      "dishwasher",
      "soap",
      "hand wash",
      "body wash",
      "shampoo",
      "conditioner",
      "toothpaste",
      "toothbrush",
      "mouthwash",
      "floss",
      "deodorant",
      "razor",
      "lotion",
      "moisturizer",
      "moisturiser",
      "sunscreen",
      "cotton swab",
      "cotton bud",
      "tissue",
      "toilet paper",
      "toilet roll",
      "paper towel",
      "kitchen roll",
      "napkin",
      "sponge",
      "scrubber",
      "bleach",
      "cleaner",
      "disinfectant",
      "polish",
      "wipe",
      "trash bag",
      "bin bag",
      "garbage bag",
      "ziploc",
      "freezer bag",
      "sandwich bag",
      "foil",
      "cling film",
      "cling wrap",
      "plastic wrap",
      "parchment",
      "wax paper",
      "battery",
      "light bulb",
      "bulb",
      "candle",
      "match",
      "lighter",
      "air freshener",
      "fabric softener",
      "dryer sheet",
      "glove",
      "mask",
      "sanitizer",
      "laundry",
    ],
  },
  {
    type: "food",
    terms: [
      // proteins
      "chicken",
      "beef",
      "pork",
      "lamb",
      "turkey",
      "bacon",
      "ham",
      "sausage",
      "salami",
      "pepperoni",
      "prosciutto",
      "chorizo",
      "jerky",
      "mince",
      "meatball",
      "patty",
      "nugget",
      "fillet",
      "steak",
      "chop",
      "rib",
      "roast",
      "brisket",
      "drumstick",
      "burger",
      "hamburger",
      "fish",
      "salmon",
      "tuna",
      "cod",
      "haddock",
      "trout",
      "mackerel",
      "sardine",
      "anchovy",
      "shrimp",
      "prawn",
      "crab",
      "lobster",
      "mussel",
      "clam",
      "oyster",
      "scallop",
      "squid",
      // dairy & eggs
      "egg",
      "milk",
      "cream",
      "cheese",
      "butter",
      "yogurt",
      "yoghurt",
      "margarine",
      // bakery & grains
      "bread",
      "breadcrumb",
      "crumb",
      "bun",
      "bagel",
      "baguette",
      "croissant",
      "muffin",
      "tortilla",
      "pita",
      "naan",
      "cracker",
      "biscuit",
      "cookie",
      "rice",
      "pasta",
      "noodle",
      "spaghetti",
      "macaroni",
      "penne",
      "ramen",
      "flour",
      "cornstarch",
      "cornflour",
      "cereal",
      "oat",
      "granola",
      "muesli",
      "cornflake",
      // pantry staples
      "sugar",
      "salt",
      "pepper",
      "spice",
      "herb",
      "oil",
      "vinegar",
      "sauce",
      "ketchup",
      "mustard",
      "mayo",
      "mayonnaise",
      "honey",
      "jam",
      "jelly",
      "marmalade",
      "syrup",
      "peanut butter",
      "yeast",
      "stock",
      "broth",
      "bouillon",
      "tofu",
      "tempeh",
      "hummus",
      "salsa",
      // produce
      "onion",
      "garlic",
      "ginger",
      "tomato",
      "potato",
      "carrot",
      "celery",
      "broccoli",
      "cauliflower",
      "spinach",
      "kale",
      "lettuce",
      "cabbage",
      "cucumber",
      "zucchini",
      "courgette",
      "eggplant",
      "aubergine",
      "pumpkin",
      "squash",
      "pea",
      "bean",
      "lentil",
      "chickpea",
      "corn",
      "mushroom",
      "chilli",
      "chili",
      "apple",
      "banana",
      "orange",
      "lemon",
      "lime",
      "grape",
      "mango",
      "pineapple",
      "peach",
      "pear",
      "plum",
      "cherry",
      "apricot",
      "kiwi",
      "melon",
      "watermelon",
      "avocado",
      "strawberry",
      "strawberries",
      "blueberry",
      "blueberries",
      "raspberry",
      "raspberries",
      "berry",
      "berries",
      // nuts, snacks & drinks
      "coconut",
      "almond",
      "walnut",
      "cashew",
      "peanut",
      "pistachio",
      "pecan",
      "nut",
      "seed",
      "sesame",
      "coffee",
      "tea",
      "juice",
      "water",
      "soda",
      "beer",
      "wine",
      "chocolate",
      "candy",
      "crisp",
      "chip",
      "snack",
      "popcorn",
      "pretzel",
    ],
  },
  {
    type: "equipment",
    terms: [
      "pan",
      "pot",
      "kettle",
      "toaster",
      "blender",
      "mixer",
      "whisk",
      "spatula",
      "grater",
      "peeler",
      "ladle",
      "colander",
      "knife",
      "fork",
      "spoon",
      "plate",
      "bowl",
      "mug",
      "glass",
      "jug",
      "tray",
      "cutting board",
      "chopping board",
      "oven",
      "microwave",
      "stove",
      "iron",
      "vacuum",
      "hammer",
      "screwdriver",
      "drill",
      "wrench",
      "plier",
      "saw",
      "nail",
      "screw",
      "tape measure",
      "ladder",
      "charger",
      "cable",
      "adapter",
      "laptop",
      "computer",
      "monitor",
      "keyboard",
      "mouse",
      "phone",
      "tablet",
      "headphone",
      "earphone",
      "speaker",
      "television",
      "remote",
      "lamp",
      "fan",
      "heater",
      "router",
      "printer",
      "camera",
      "watch",
      "clock",
      "scissors",
      "stapler",
    ],
  },
  {
    type: "clothing",
    terms: [
      "shirt",
      "t shirt",
      "pant",
      "trouser",
      "jean",
      "short",
      "skirt",
      "dress",
      "jacket",
      "coat",
      "sweater",
      "jumper",
      "hoodie",
      "sweatshirt",
      "sock",
      "underwear",
      "boxer",
      "bra",
      "hat",
      "beanie",
      "cap",
      "scarf",
      "tie",
      "shoe",
      "boot",
      "sandal",
      "slipper",
      "sneaker",
      "trainer",
      "pajama",
      "pyjama",
      "legging",
      "blouse",
      "cardigan",
      "vest",
      "uniform",
      "swimsuit",
      "mitten",
      "jersey",
    ],
  },
  {
    type: "document",
    terms: [
      "passport",
      "visa",
      "license",
      "licence",
      "certificate",
      "diploma",
      "warranty",
      "receipt",
      "invoice",
      "contract",
      "insurance",
      "policy",
      "deed",
      "statement",
      "ticket",
      "voucher",
      "manual",
      "folder",
      "envelope",
      "paperwork",
      "document",
    ],
  },
];

const NAME_HINTS: { type: ItemType; re: RegExp }[] = TYPE_TERMS.map(
  ({ type, terms }) => ({
    type,
    re: new RegExp(
      `\\b(?:${terms
        .map((t) =>
          t
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // escape regex specials
            .replace(/\s+/g, "[\\s-]*"),
        ) // "band aid" → band-aid / bandaid too
        .join("|")})(?:es|s)?\\b`,
      "i",
    ),
  }),
);

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
 * Best-guess type for a name, in priority order: the user's own remembered type
 * for that exact name (`typeHints`, learned from what they've typed before) →
 * the curated name lexicon → the crowd consensus (what everyone else files this
 * name under, `crowdHints`) → null. The user's own choice wins first; the lexicon
 * is high-precision for common items; the crowd fills the long tail the lexicon
 * misses without ever overriding a curated guess.
 */
function guessType(
  name: string,
  typeHints: Record<string, ItemType>,
  crowdHints: Record<string, ItemType> = {},
): ItemType | null {
  const key = name.trim().toLowerCase();
  return typeHints[key] ?? inferTypeFromName(name) ?? crowdHints[key] ?? null;
}

/** A single (name, type, user) vote feeding the crowd consensus. */
export type TypeVote = { name: string; itemType: ItemType; userId: string };

/**
 * Aggregate a name→type consensus from item/PO rows across all users. Votes are
 * counted as DISTINCT USERS (not rows) so no single prolific user can sway a
 * name, and a name only surfaces once it clears a k-anonymity threshold — a rare
 * or personal name (used by fewer than `minUsers` people) never appears, so no
 * individual's naming leaks. The winning type must also hold a clear majority
 * (`minConsensus`) of that name's distinct users, else the name is dropped as
 * ambiguous. Only concrete (non-"other") types carry signal.
 */
export function buildTypeConsensus(
  rows: TypeVote[],
  opts: {
    minUsers?: number;
    minConsensus?: number;
    excludeUserId?: string;
  } = {},
): Record<string, ItemType> {
  const { minUsers = 5, minConsensus = 0.6, excludeUserId } = opts;
  // name → type → set of distinct users who filed that name under that type.
  const votes = new Map<string, Map<ItemType, Set<string>>>();
  for (const r of rows) {
    if (r.itemType === "other") continue;
    if (excludeUserId && r.userId === excludeUserId) continue;
    const key = r.name.trim().toLowerCase();
    if (!key || !r.userId) continue;
    let byType = votes.get(key);
    if (!byType) votes.set(key, (byType = new Map()));
    let users = byType.get(r.itemType);
    if (!users) byType.set(r.itemType, (users = new Set()));
    users.add(r.userId);
  }

  const out: Record<string, ItemType> = {};
  for (const [key, byType] of votes) {
    let winner: ItemType | null = null;
    let winnerUsers = 0;
    const allUsers = new Set<string>();
    for (const [type, users] of byType) {
      for (const u of users) allUsers.add(u);
      if (users.size > winnerUsers) {
        winner = type;
        winnerUsers = users.size;
      }
    }
    const totalUsers = allUsers.size; // distinct people who use this name at all
    if (!winner) continue;
    if (totalUsers < minUsers) continue; // k-anonymity: not enough people
    if (winnerUsers / totalUsers < minConsensus) continue; // too ambiguous
    out[key] = winner;
  }
  return out;
}

/**
 * Infer all shopping-row metadata from a name. Prefers inheriting from a matched
 * existing item; otherwise guesses the type from the user's memory / name lexicon
 * and shelves it to a fitting block. Always resolves a location when the store
 * has any standard block. `typeHints` is the user's own name→type memory;
 * `crowdHints` is the k-anonymous cross-user consensus (see `buildTypeConsensus`).
 */
export function inferPOFields(
  name: string,
  items: Item[],
  blocks: BlocksMap,
  typeHints: Record<string, ItemType> = {},
  crowdHints: Record<string, ItemType> = {},
): POInference {
  const match = matchExistingItem(name, items);
  if (match) {
    // Prefer the matched item's type — but only if it's a concrete one. Lots of
    // older items predate type capture and sit at "other"; in that case defer to
    // the user's memory / name lexicon / crowd so "Plain Flour" still reads as food.
    const matchType = match.itemType ?? "other";
    const type =
      matchType !== "other"
        ? matchType
        : (guessType(name, typeHints, crowdHints) ?? "other");
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
  const itemType = guessType(name, typeHints, crowdHints) ?? "other";
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
