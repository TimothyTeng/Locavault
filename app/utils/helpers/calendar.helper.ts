// Date helpers for the store calendar (DESIGN.md §7). Date-only, local —
// entries are keyed by "YYYY-MM-DD" so a planned day never drifts by timezone.
// Pure: every function takes its reference date in, so they're testable.

/** Local "YYYY-MM-DD" for a date. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a "YYYY-MM-DD" key back to a local-midnight Date. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** A new date `n` days after `d` (n may be negative). */
export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Monday-start week containing `d` (local midnight of that Monday). */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // Mon=0 … Sun=6
  out.setDate(out.getDate() - dow);
  return out;
}

/** The seven local-midnight dates of the week starting at `weekStart`. */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Same calendar day? */
export function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
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

/** "Mon 23" style parts for a day cell. */
export function dayParts(d: Date): {
  weekday: string;
  day: number;
  month: string;
} {
  return {
    weekday: WEEKDAYS[d.getDay()],
    day: d.getDate(),
    month: MONTHS[d.getMonth()],
  };
}

/** "Jun 23 – 29" label for a week. */
export function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const a = dayParts(weekStart);
  const b = dayParts(end);
  return a.month === b.month
    ? `${a.month} ${a.day} – ${b.day}`
    : `${a.month} ${a.day} – ${b.month} ${b.day}`;
}

const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Local midnight of the first day of `d`'s month. */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** A new date `n` months from `d` (n may be negative); clamps day to month end. */
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Same calendar month (and year)? */
export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * A 6×7 grid of local-midnight dates covering `month`, Monday-aligned. Always 42
 * cells so the grid height is stable across months; leading/trailing days spill
 * into the adjacent months (use `isSameMonth` to dim them).
 */
export function monthGrid(month: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(month));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** "June 2026" label for a month. */
export function monthLabel(month: Date): string {
  return `${MONTHS_FULL[month.getMonth()]} ${month.getFullYear()}`;
}
