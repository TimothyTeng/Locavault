// Pure shaping for the dashboard Insights panel. Spend aggregation itself lives in
// money.helper (bucketSpend) + queries (getSpend*); this fills the gaps so the
// chart has a continuous month axis and a friendly label per bar.

import type { SpendBucket } from "./money.helper";

export type MonthPoint = { key: string; label: string; cents: number };

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Expand month spend buckets into a continuous series of the last `months`
 * calendar months ending at `now` (oldest → newest), filling absent months with
 * 0 so the chart axis has no gaps. Bucket keys are "YYYY-MM" (as `bucketSpend`
 * emits for period "month").
 */
export function monthlySpendSeries(
  buckets: SpendBucket[],
  months: number,
  now: Date,
): MonthPoint[] {
  const byKey = new Map(buckets.map((b) => [b.key, b.cents]));
  const out: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      key,
      label: MONTH_LABELS[d.getMonth()],
      cents: byKey.get(key) ?? 0,
    });
  }
  return out;
}
