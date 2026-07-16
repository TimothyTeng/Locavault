import type { ItemType, Condition } from "./itemTypeTypes";

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
  cost: number | null; // cents
  expiryDate: Date | null;
  useRate: number | null;
  useRatePeriod: "day" | "week" | "month" | null;
  // Transient "packed/out" loan state — true while in a checked-out collection.
  checkedOut?: boolean;
  // Trade: listed on the global Bazaar + optional "looking for…" note.
  forTrade?: boolean;
  tradeNote?: string | null;
  // Snooze/dismiss for this item's alerts — while in the future, getItemStatus
  // stays quiet (DESIGN.md §6).
  alertSnoozedUntil?: Date | null;
  // Durable-trait fields (equipment etc.) — see schema. Optional on the type so
  // optimistic/partial rows stay valid.
  warrantyUntil?: Date | null;
  serialNumber?: string | null;
  condition?: Condition | null;
  maintenanceIntervalDays?: number | null;
  lastMaintainedAt?: Date | null;
  // Derived (server-computed) — usage prediction. Absent on optimistic rows.
  usage?: UsageEstimate;
  // Derived — the predicted run-out has passed but stock remains: show the
  // one-tap confirm-loop question ("out? / still have it") on the status chip.
  runoutConfirm?: boolean;
};

export type ItemStatus = "out" | "low" | "expiring" | "ok";

// ─── USAGE PREDICTION ──────────────────────────────────────

/** Where a usage estimate came from. `prior` = a gentle guess from the item type
 *  before we have real data ("still learning"). */
export type UsageSource = "history" | "manual" | "prior" | "none";

/** How much to trust the estimate, driven by sample size + span. */
export type UsageConfidence = "high" | "medium" | "low" | "none";

/**
 * A coarse, human-facing "when does this run out?" band. Phrases are shown as the
 * chip; the exact day range lives in the tooltip. `learning` means the spread is
 * too wide to commit to a week (honest uncertainty, regardless of the mean).
 */
export type RunoutBucket =
  | "out"
  | "days"
  | "this_week"
  | "next_week"
  | "later"
  | "learning";

/** A single quantity-change record used to learn usage (outflow + inflow). */
export type UsageLog = {
  delta: number; // negative = consumed, positive = restocked
  loggedAt: Date | null;
  note?: string | null; // e.g. "out", "edit", "cooked", "dose", "confirmed"
};

/** Result of estimating how fast an item is consumed and when it runs out. */
export type UsageEstimate = {
  dailyRate: number | null; // posterior-mean units consumed per day
  source: UsageSource;
  confidence: UsageConfidence;
  runoutDays: number | null; // whole days from "now" until quantity hits 0 (point)
  runoutDate: Date | null;
  runoutEarly: number | null; // p25 (Lomax-predictive) — earliest plausible run-out
  runoutLate: number | null; // p75 — latest plausible run-out
  bucket: RunoutBucket;
  events: number; // consumption events that backed the estimate
  windowDays: number; // span of history considered
};
