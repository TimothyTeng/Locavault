import type { Item, ItemStatus } from "~/types/storeTypes";
import { expiryDateRemainingDays, remainingDays } from "./store.helper";

export function formatCost(cents: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

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
  const runoutDaysVal = itemRunoutDays(item);
  // Only an evidence-backed estimate (real history or a user-entered rate) may
  // raise a low-stock alert — a `prior` guess stays silent ("still learning").
  const evidenceBased =
    item.usage == null
      ? item.useRate != null && item.useRatePeriod != null
      : item.usage.source === "history" || item.usage.source === "manual";
  if (
    (item.minQuantity != null && item.quantity <= item.minQuantity) ||
    (evidenceBased && runoutDaysVal != null && runoutDaysVal <= 7)
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