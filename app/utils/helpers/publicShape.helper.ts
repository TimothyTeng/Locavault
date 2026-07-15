// Public/viewer projections. A store's loader returns the same objects to owners
// and to anonymous "public" visitors / invited viewers, so internal fields would
// otherwise ride along in the loader JSON even when the UI hides them. These
// helpers strip what a non-privileged viewer has no business seeing — the owner's
// Clerk id, and per-item purchase economics (cost/sku/reorder thresholds/trade
// wants). Fields are nulled/blanked rather than omitted so the client item/store
// types stay stable (cost etc. are already nullable).

import type { Item } from "~/types/storeTypes";
import type { CreateStoreInput } from "~/types/storeViewFinderTypes";

/** Redact owner identity from a store shown to a public/viewer visitor. */
export function toPublicStore(store: CreateStoreInput): CreateStoreInput {
  return { ...store, userId: "" };
}

/** Drop purchase economics + internal reorder data from a publicly-shown item. */
export function toPublicItem(item: Item): Item {
  return {
    ...item,
    cost: null,
    sku: null,
    minQuantity: null,
    useRate: null,
    useRatePeriod: null,
    tradeNote: null,
  };
}
