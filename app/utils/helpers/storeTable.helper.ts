import type { Item, ItemStatus } from "~/types/storeTypes";
import { expiryDateRemainingDays, remainingDays } from "./store.helper";
import { TYPE_RUNOUT_THRESHOLD_DAYS, hasTrait } from "~/lib/itemTypes";

/**
 * Would this item benefit from a detail the fast-capture path skipped? A
 * perishable item with no expiry, or a depleting one with no min-stock, can't be
 * predicted well — the "enrich later" queue surfaces these gently. Out-of-stock
 * items are excluded (nothing to enrich). Pure — drives the StoreOverview chip.
 */
export function itemNeedsDetails(item: Item): boolean {
  if (item.quantity <= 0) return false;
  if (hasTrait(item.itemType, "perishable") && item.expiryDate == null)
    return true;
  if (hasTrait(item.itemType, "depletes") && item.minQuantity == null)
    return true;
  return false;
}

// Single source of truth lives in money.helper; re-exported here for the
// existing store-table call sites.
// `formatCost` is the store-table's historical name for the canonical
// `formatMoney` (cents → "$12.34"); aliased so existing call sites keep working.
export { formatMoney as formatCost } from "./money.helper";

export function formatExpiry(
  date: Date | null,
): { label: string; status: "expired" | "soon" | "ok" } | "—" {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.ceil(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const label = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (diffDays < 0) return { label, status: "expired" };
  if (diffDays <= 30) return { label, status: "soon" };
  return { label, status: "ok" };
}

export function formatUseRate(
  rate: number | null,
  period: "day" | "week" | "month" | null,
) {
  if (!rate || !period) return "—";
  return `${rate} / ${period}`;
}

/**
 * Best available "days until run-out" for an item: prefers the server-computed
 * usage estimate (learned from history), falling back to the manual use-rate.
 */
export function itemRunoutDays(item: Item): number | null {
  if (item.usage?.runoutDays != null) return item.usage.runoutDays;
  if (item.useRate && item.useRatePeriod) {
    return remainingDays(
      item.createdAt,
      item.useRate.toString(),
      item.useRatePeriod,
      item.quantity,
    );
  }
  return null;
}

export function getItemStatus(item: Item): ItemStatus {
  if (item.quantity <= 0) return "out";
  // Snoozed/dismissed: stay quiet on low/expiring until the snooze passes (a
  // factual "out" above still shows). DESIGN §6 — gentle, never nagging.
  if (item.alertSnoozedUntil && item.alertSnoozedUntil.getTime() > Date.now()) {
    return "ok";
  }
  const runoutDaysVal = itemRunoutDays(item);
  // Only an evidence-backed estimate (real history or a user-entered rate) may
  // raise a low-stock alert — a `prior` guess stays silent ("still learning").
  const evidenceBased =
    item.usage == null
      ? item.useRate != null && item.useRatePeriod != null
      : item.usage.source === "history" || item.usage.source === "manual";
  const runoutThreshold = TYPE_RUNOUT_THRESHOLD_DAYS[item.itemType];
  if (
    (item.minQuantity != null && item.quantity <= item.minQuantity) ||
    (evidenceBased && runoutDaysVal != null && runoutDaysVal <= runoutThreshold)
  ) {
    return "low";
  }
  if (item.expiryDate) {
    const diffDays = Math.ceil(
      (new Date(item.expiryDate).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    );
    if (diffDays <= 30) return "expiring";
  }
  return "ok";
}

export type SortKey = "name" | "quantity" | "expiry" | "depletion" | "status";
export type SortDir = "asc" | "desc";

export type FilterState = {
  statuses: Set<ItemStatus>;
  hasExpiry: boolean;
  hasUseRate: boolean;
};

export const STATUS_ORDER: ItemStatus[] = ["out", "low", "expiring", "ok"];

export function getSortValue(item: Item, key: SortKey): number | string {
  switch (key) {
    case "name":
      return item.name.toLowerCase();
    case "quantity":
      return item.quantity;
    case "expiry": {
      const d = expiryDateRemainingDays(item.expiryDate);
      return d ?? Infinity;
    }
    case "depletion": {
      const d = itemRunoutDays(item);
      return d ?? Infinity;
    }
    case "status":
      return STATUS_ORDER.indexOf(getItemStatus(item));
  }
}

export const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  quantity: "Qty",
  expiry: "Expiry",
  depletion: "Est Depletion",
  status: "Status",
};
