import type { Item, ItemStatus } from "~/types/storeTypes";
import { remainingDays } from "./store.helper";

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

export function getItemStatus(item: Item): ItemStatus {
  if (item.quantity <= 0) return "out";
  const runoutDaysVal =
    item.useRate && item.useRatePeriod
      ? remainingDays(
          item.createdAt,
          item.useRate.toString(),
          item.useRatePeriod,
          item.quantity,
        )
      : null;
  if (
    (item.minQuantity != null && item.quantity <= item.minQuantity) ||
    (item.useRate != null &&
      item.useRatePeriod != null &&
      runoutDaysVal != null &&
      runoutDaysVal <= 7)
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