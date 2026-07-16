// Item-type registry: the single source of truth mapping each item TYPE to its
// TRAITS, and traits to the form fields / behaviours they enable. Features query
// traits (e.g. "items with the `edible` trait"), never the type label, so adding
// a future type is just a new bundle here. See DESIGN.md §5.

import type { ItemType, Trait, Condition, Season } from "~/types/itemTypeTypes";

export type { ItemType, Trait, Condition, Season };

/** Allowed physical-condition values (for `oneOf` validation + a select). */
export const CONDITIONS: Condition[] = ["new", "good", "worn", "broken"];

/** Allowed seasonal buckets (for `oneOf` validation + a select). */
export const SEASONS: Season[] = ["all", "summer", "winter", "transitional"];

/** Ordered list for dropdowns. `other` last as the catch-all. */
export const ITEM_TYPES: ItemType[] = [
  "food",
  "medication",
  "supplies",
  "equipment",
  "clothing",
  "document",
  "other",
];

export const DEFAULT_ITEM_TYPE: ItemType = "other";

/** Each type is a preset bundle of traits. */
export const TYPE_TRAITS: Record<ItemType, Trait[]> = {
  food: ["edible", "perishable", "depletes"],
  medication: ["dosed", "perishable", "depletes"],
  supplies: ["depletes"],
  equipment: ["durable"],
  clothing: ["sized"],
  document: ["perishable"],
  other: [],
};

export const TYPE_META: Record<ItemType, { label: string; hint: string }> = {
  food: { label: "Food", hint: "Edible — tracks expiry & run-out" },
  medication: { label: "Medication", hint: "Doses, refills & expiry" },
  supplies: {
    label: "Supplies",
    hint: "Cleaning, toiletries, paper — tracks run-out",
  },
  equipment: { label: "Equipment", hint: "Tools, electronics, durables" },
  clothing: { label: "Clothing", hint: "Size & season" },
  document: { label: "Documents", hint: "Passport, insurance, keys" },
  other: { label: "Other", hint: "Anything else" },
};

export function hasTrait(type: ItemType, trait: Trait): boolean {
  return (TYPE_TRAITS[type] ?? []).includes(trait);
}

/**
 * How many days of projected stock counts as "running low" for each type — the
 * lead time you'd want before it's gone. Medication needs the longest runway (a
 * refill/prescription can't be same-day); documents rarely deplete so their
 * threshold is generous; food/supplies are short-cycle. Consumed by
 * `getItemStatus`. (A future blue "action" tier for dose reminders lands with
 * Reminders in Phase 6.)
 */
export const TYPE_RUNOUT_THRESHOLD_DAYS: Record<ItemType, number> = {
  food: 7,
  medication: 14,
  supplies: 10,
  equipment: 7,
  clothing: 7,
  document: 30,
  other: 7,
};

/**
 * Which of the form's fields apply to a type. Trait-driven: `edible`→unit,
 * `perishable`→expiry, `depletes`→use-rate + min qty, `durable`→warranty,
 * serial, condition, and maintenance cadence, and `sized`→size, season &
 * variant (clothing and other seasonal goods). (`dosed` fields still to come.)
 */
export type FormFields = {
  unit: boolean;
  expiry: boolean;
  useRate: boolean;
  minQuantity: boolean;
  warranty: boolean;
  serial: boolean;
  condition: boolean;
  maintenance: boolean;
  size: boolean;
  season: boolean;
  variant: boolean;
};

export function fieldsForType(type: ItemType): FormFields {
  const durable = hasTrait(type, "durable");
  const sized = hasTrait(type, "sized");
  return {
    unit: hasTrait(type, "edible"),
    expiry: hasTrait(type, "perishable"),
    useRate: hasTrait(type, "depletes"),
    minQuantity: hasTrait(type, "depletes"),
    warranty: durable,
    serial: durable,
    condition: durable,
    maintenance: durable,
    size: sized,
    season: sized,
    variant: sized,
  };
}

// Keyword → type, used to pre-select the type from a zone / category label so
// assignment stays one-tap. Order matters: more specific patterns first.
const TYPE_HINTS: { type: ItemType; re: RegExp }[] = [
  {
    type: "medication",
    re: /medic|pharma|pill|drug|first.?aid|vitamin|health/i,
  },
  {
    type: "food",
    re: /food|grocer|pantry|fridge|freezer|kitchen|dairy|produce|snack|drink|beverage|fruit|veg|meat|spice|bak/i,
  },
  {
    type: "supplies",
    re: /clean|laundry|detergent|toiletr|hygiene|paper|soap|shampoo|tissue|bathroom|consumable|suppl/i,
  },
  {
    type: "equipment",
    re: /garage|tool|equip|electronic|gadget|appliance|hardware|workshop|device/i,
  },
  { type: "clothing", re: /wardrobe|cloth|apparel|shoe|closet|outfit/i },
  {
    type: "document",
    re: /document|paperwork|\bfile|passport|insurance|certificate|\bkey/i,
  },
];

/** Best-guess type from a free-text zone/category label, or null if unknown. */
export function inferTypeFromLabel(label?: string | null): ItemType | null {
  if (!label) return null;
  for (const { type, re } of TYPE_HINTS) if (re.test(label)) return type;
  return null;
}
