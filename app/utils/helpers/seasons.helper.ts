// Seasonal-rotation nudges for sized items (clothing etc.). Pure + deterministic:
// given an item's `season` bucket and "now", decide whether it's time to bring
// those pieces out or pack them away — surfaced in the attention digest around
// the season boundaries so it never nags mid-season.
//
// The app has no location signal, so the windows follow a pragmatic Northern-
// hemisphere calendar. `all`/absent seasons never rotate.

import type { Season } from "~/types/itemTypeTypes";

const DAY_MS = 86_400_000;

/** How early to nudge "bring these out", and how long after a season ends to
 * nudge "pack these away". Three weeks each — enough lead time to act, short
 * enough that the reminder clears itself once you're mid-season. */
const LEAD_DAYS = 21;
const TRAIL_DAYS = 21;

type MonthDay = { m: number; d: number }; // m is 0-indexed (0 = Jan)

/** Season windows [start, end) on the calendar. Winter wraps the year end. */
const WINDOWS: Record<"summer" | "winter", { start: MonthDay; end: MonthDay }> =
  {
    summer: { start: { m: 5, d: 1 }, end: { m: 8, d: 1 } }, // Jun 1 – Sep 1
    winter: { start: { m: 11, d: 1 }, end: { m: 2, d: 1 } }, // Dec 1 – Mar 1
  };

function at(md: MonthDay, year: number): Date {
  return new Date(year, md.m, md.d);
}

/** The next time this month/day occurs at or after `now`. */
function nextOccurrence(md: MonthDay, now: Date): Date {
  const y = now.getFullYear();
  const thisYear = at(md, y);
  return thisYear.getTime() > now.getTime() ? thisYear : at(md, y + 1);
}

/** The most recent time this month/day occurred at or before `now`. */
function prevOccurrence(md: MonthDay, now: Date): Date {
  const y = now.getFullYear();
  const thisYear = at(md, y);
  return thisYear.getTime() <= now.getTime() ? thisYear : at(md, y - 1);
}

const daysBetween = (a: Date, b: Date) =>
  Math.round((a.getTime() - b.getTime()) / DAY_MS);

/** The active season for `now` (only summer/winter are actionable). */
export function currentSeason(now: Date): "summer" | "winter" | "transitional" {
  const m = now.getMonth();
  if (m === 11 || m <= 1) return "winter"; // Dec, Jan, Feb
  if (m >= 5 && m <= 7) return "summer"; // Jun, Jul, Aug
  return "transitional";
}

export type Rotation = {
  /** "surface" = bring these out; "store" = pack these away. */
  action: "surface" | "store";
  /** A ready-to-show phrase for the digest. */
  phrase: string;
  /** Days until the season starts (surface) or since it ended (store). */
  days: number;
};

/**
 * A rotation suggestion for a sized item's `season`, or null when nothing is due.
 * Surfaces the item ~3 weeks before its season starts, and nudges to pack it away
 * for ~3 weeks after its season ends. `all`/null/transitional never rotate.
 */
export function seasonRotation(
  season: Season | null | undefined,
  now: Date,
): Rotation | null {
  if (season !== "summer" && season !== "winter") return null;
  const win = WINDOWS[season];
  const label = season[0].toUpperCase() + season.slice(1);

  const daysUntilStart = daysBetween(nextOccurrence(win.start, now), now);
  if (daysUntilStart >= 0 && daysUntilStart <= LEAD_DAYS) {
    return {
      action: "surface",
      days: daysUntilStart,
      phrase:
        daysUntilStart === 0
          ? `${label} starts today — bring these out`
          : `${label} in ${daysUntilStart}d — bring these out`,
    };
  }

  const daysSinceEnd = daysBetween(now, prevOccurrence(win.end, now));
  if (daysSinceEnd >= 0 && daysSinceEnd <= TRAIL_DAYS) {
    return {
      action: "store",
      days: daysSinceEnd,
      phrase: `${label} is over — pack these away`,
    };
  }

  return null;
}
