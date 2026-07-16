// Money is stored in cents everywhere (items.cost, purchaseOrderItems.cost,
// itemLogs.costCents). These helpers keep the cents→display and roll-up math in
// one tested place. `formatMoney` is the canonical cents→string formatter.

/**
 * Parse a price token into cents. Handles "$12.34", "12.34", "12,34" (comma
 * decimal), "1,234.56" (thousands), and a bare "12" (→ 1200). Returns null if
 * there's no parseable number. Sign is preserved so callers can reject refunds.
 */
export function parseMoneyToCents(raw: string): number | null {
  if (typeof raw !== "string") return null;
  const neg = /-/.test(raw);
  // Keep digits and separators only.
  const s = raw.replace(/[^\d.,]/g, "");
  if (!s) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  // The right-most separator is the decimal point; the other is a thousands sep.
  const decPos = Math.max(lastDot, lastComma);
  let cents: number;
  if (decPos === -1) {
    // No separator at all → whole units.
    const n = parseInt(s, 10);
    if (!Number.isFinite(n)) return null;
    cents = n * 100;
  } else {
    const decimals = s.slice(decPos + 1).replace(/\D/g, "");
    const whole = s.slice(0, decPos).replace(/\D/g, "");
    if (!whole && !decimals) return null;
    const frac = (decimals + "00").slice(0, 2);
    cents = parseInt(whole || "0", 10) * 100 + parseInt(frac, 10);
  }
  if (!Number.isFinite(cents)) return null;
  return neg ? -cents : cents;
}

/** Format a cents amount as "$12.34"; null/undefined → "—". */
export function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const neg = cents < 0;
  const s = `$${(Math.abs(cents) / 100).toFixed(2)}`;
  return neg ? `-${s}` : s;
}

/**
 * Basket total (cents) for a set of rows priced per unit: Σ cost × quantity.
 * Rows without a cost contribute nothing. Returns `{ cents, priced, unpriced }`
 * so the UI can note "3 items have no price yet" rather than silently undercount.
 */
export function basketTotal(
  rows: { cost: number | null; quantity: number }[],
): { cents: number; priced: number; unpriced: number } {
  let cents = 0;
  let priced = 0;
  let unpriced = 0;
  for (const r of rows) {
    if (r.cost != null) {
      cents += r.cost * Math.max(0, r.quantity);
      priced += 1;
    } else {
      unpriced += 1;
    }
  }
  return { cents, priced, unpriced };
}

/**
 * Approximate spend over a period from restock logs: for each positive (restock)
 * delta, value it at the item's unit cost. Consumption (negative) and zero-delta
 * confirmations are ignored. Deliberately rough — a passive "~spent this month"
 * signal, not accounting. Prefer `itemLogs.costCents` (via bucketSpend) where a
 * snapshotted spend is available; this is the fallback for un-snapshotted rows.
 */
export function spentCents(
  logs: { itemId: string; delta: number }[],
  costByItem: Map<string, number | null>,
): number {
  let cents = 0;
  for (const l of logs) {
    if (l.delta <= 0) continue;
    const cost = costByItem.get(l.itemId);
    if (cost != null) cents += cost * l.delta;
  }
  return cents;
}

/** Sum a list of nullable cent amounts, treating null as 0. */
export function sumCents(amounts: Array<number | null | undefined>): number {
  return amounts.reduce<number>((total, c) => total + (c ?? 0), 0);
}

export type SpendPoint = { costCents: number | null; loggedAt: Date | null };
export type SpendBucket = { key: string; cents: number };

/**
 * Roll spend rows (itemLogs.costCents snapshots) into per-period buckets keyed by
 * local date. `period` picks the bucket granularity: "day" → YYYY-MM-DD, "week" →
 * YYYY-Www (ISO-ish, Monday start), "month" → YYYY-MM. Rows without a cost or
 * timestamp are skipped. Buckets are returned in chronological key order.
 */
export function bucketSpend(
  rows: SpendPoint[],
  period: "day" | "week" | "month" = "month",
): SpendBucket[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (r.costCents == null || !r.loggedAt) continue;
    const key = periodKey(r.loggedAt, period);
    totals.set(key, (totals.get(key) ?? 0) + r.costCents);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, cents]) => ({ key, cents }));
}

/** Local period key for a date at the given granularity. */
export function periodKey(
  date: Date,
  period: "day" | "week" | "month",
): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  if (period === "month") return `${y}-${m}`;
  if (period === "day") {
    return `${y}-${m}-${String(date.getDate()).padStart(2, "0")}`;
  }
  // Week: ISO week number (Monday-start), keyed as YYYY-Www.
  const { isoYear, week } = isoWeek(date);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** ISO-8601 week number + its ISO week-year, computed in local time. */
function isoWeek(date: Date): { isoYear: number; week: number } {
  // Copy to a Thursday of the same ISO week — the year of that Thursday is the
  // ISO week-year, and the week index follows from it.
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - day + 3); // move to Thursday
  const isoYear = d.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return { isoYear, week };
}
