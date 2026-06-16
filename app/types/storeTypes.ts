import type { ItemType } from "./itemTypeTypes";

export type Item = {
  id: string;
  name: string;
  quantity: number;
  description: string | null;
  storeId: string;
  blockId: string | null;
  createdAt: Date | null;
  isPublic: boolean;
  itemType: ItemType;
  // Extended fields
  sku: string | null;
  unit: string | null;
  minQuantity: number | null;
  cost: number | null;             // cents
  expiryDate: Date | null;
  useRate: number | null;
  useRatePeriod: "day" | "week" | "month" | null;
  // Transient "packed/out" loan state — true while in a checked-out collection.
  checkedOut?: boolean;
  // Derived (server-computed) — usage prediction. Absent on optimistic rows.
  usage?: UsageEstimate;
};

export type ItemStatus = "out" | "low" | "expiring" | "ok";

// ─── USAGE PREDICTION ──────────────────────────────────────

/** Where a usage estimate came from. `prior` = a gentle guess from the item type
 *  before we have real data ("still learning"). */
export type UsageSource = "history" | "manual" | "prior" | "none";

/** How much to trust the estimate, driven by sample size + span. */
export type UsageConfidence = "high" | "medium" | "low" | "none";

/** A single quantity-change record used to learn usage (outflow + inflow). */
export type UsageLog = {
  delta: number; // negative = consumed, positive = restocked
  loggedAt: Date | null;
};

/** Result of estimating how fast an item is consumed and when it runs out. */
export type UsageEstimate = {
  dailyRate: number | null; // units consumed per day
  source: UsageSource;
  confidence: UsageConfidence;
  runoutDays: number | null; // whole days from "now" until quantity hits 0
  runoutDate: Date | null;
  events: number; // consumption events that backed the estimate
  windowDays: number; // span of history considered
};