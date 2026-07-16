// Pure signals for the `durable` trait (equipment etc.): when a warranty lapses
// and when the next service is due. Structural inputs so it's trivially testable
// without a full Item. Days are whole and measured from `now`; negative = past.

const DAY_MS = 86_400_000;

export type DurableLike = {
  warrantyUntil?: Date | null;
  maintenanceIntervalDays?: number | null;
  lastMaintainedAt?: Date | null;
  createdAt?: Date | null;
};

/** Whole days until the warranty expires (negative = already expired), or null. */
export function warrantyDaysLeft(item: DurableLike, now: Date): number | null {
  if (!item.warrantyUntil) return null;
  return Math.ceil((item.warrantyUntil.getTime() - now.getTime()) / DAY_MS);
}

/**
 * Whole days until the next service is due (negative = overdue), or null when no
 * cadence is set. Counts from the last service, falling back to when the item was
 * added if it's never been serviced.
 */
export function maintenanceDueDays(
  item: DurableLike,
  now: Date,
): number | null {
  if (!item.maintenanceIntervalDays || item.maintenanceIntervalDays <= 0)
    return null;
  const base = item.lastMaintainedAt ?? item.createdAt;
  if (!base) return null;
  const dueAt = base.getTime() + item.maintenanceIntervalDays * DAY_MS;
  return Math.ceil((dueAt - now.getTime()) / DAY_MS);
}

/** A short human phrase for a maintenance-due count, or null if not applicable. */
export function describeMaintenance(
  item: DurableLike,
  now: Date,
): { text: string; overdue: boolean } | null {
  const d = maintenanceDueDays(item, now);
  if (d == null) return null;
  if (d < 0) return { text: `Service overdue by ${-d}d`, overdue: true };
  if (d === 0) return { text: "Service due today", overdue: true };
  if (d <= 14) return { text: `Service in ${d}d`, overdue: false };
  return { text: `Serviced — next in ${d}d`, overdue: false };
}
