import type { DoseSchedule } from "~/types/doseTypes";
import { dateKey } from "./calendar.helper";

// Dose scheduling math (reminders v1, DESIGN.md §4/§6). Pure + local-time: every
// function takes `now` in, so they're testable. Doses are spread evenly across
// waking hours; a dose becomes "due" once its slot time has passed and it hasn't
// been taken yet. Nothing here touches the DB — adherence is read from itemLogs
// (note "dose") upstream and passed in as `takenToday`.

/** Waking window the daily doses are spread across (local hours). */
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 22;

const MAX_TIMES_PER_DAY = 4;

function localHours(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

/** Clamp a raw timesPerDay to the supported 1–4 range. */
export function clampTimesPerDay(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_TIMES_PER_DAY, Math.floor(n)));
}

/**
 * The local hour of each dose slot for `timesPerDay`, centred in equal
 * sub-intervals of the waking window (so all slots sit strictly inside it and
 * are symmetric): e.g. 1×→15:00; 2×→11:30, 18:30; 3×→10:20, 15:00, 19:40.
 */
export function doseSlotHours(timesPerDay: number): number[] {
  const n = clampTimesPerDay(timesPerDay);
  const w = DAY_END_HOUR - DAY_START_HOUR;
  return Array.from(
    { length: n },
    (_, i) => DAY_START_HOUR + ((i + 0.5) * w) / n,
  );
}

/** How many of today's dose slots have elapsed by `now` (local). */
export function slotsElapsed(timesPerDay: number, now: Date): number {
  const h = localHours(now);
  return doseSlotHours(timesPerDay).filter((t) => t <= h).length;
}

/** Is the schedule live on `now`'s calendar day? (active flag + start/end bounds,
 *  compared date-only so a time-of-day never flips the day.) */
export function scheduleActive(
  s: Pick<DoseSchedule, "active" | "startDate" | "endDate">,
  now: Date,
): boolean {
  if (!s.active) return false;
  const today = dateKey(now);
  if (dateKey(s.startDate) > today) return false; // hasn't started
  if (s.endDate && dateKey(s.endDate) < today) return false; // ended
  return true;
}

/**
 * How many doses are due right now: slots elapsed today minus doses already
 * taken today (never negative). Zero when the schedule isn't active today.
 */
export function dosesDueNow(
  s: Pick<DoseSchedule, "active" | "startDate" | "endDate" | "timesPerDay">,
  takenToday: number,
  now: Date,
): number {
  if (!scheduleActive(s, now)) return 0;
  const elapsed = slotsElapsed(s.timesPerDay, now);
  return Math.max(0, elapsed - Math.max(0, takenToday));
}

/** The next upcoming slot hour today (for "next at 3pm"), or null if all passed. */
export function nextSlotHour(timesPerDay: number, now: Date): number | null {
  const h = localHours(now);
  const next = doseSlotHours(timesPerDay).find((t) => t > h);
  return next ?? null;
}

/** "3pm" / "9am" from a decimal local hour. */
export function formatHour(hour: number): string {
  const h24 = Math.floor(hour);
  const m = Math.round((hour - h24) * 60);
  const period = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0
    ? `${h12}${period}`
    : `${h12}:${String(m).padStart(2, "0")}${period}`;
}

/** Days remaining until the schedule ends (from `now`'s day), or null if ongoing. */
export function daysUntilEnd(
  s: Pick<DoseSchedule, "endDate">,
  now: Date,
): number | null {
  if (!s.endDate) return null;
  const DAY = 86_400_000;
  const end = new Date(
    s.endDate.getFullYear(),
    s.endDate.getMonth(),
    s.endDate.getDate(),
  ).getTime();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  return Math.max(0, Math.round((end - today) / DAY));
}

/** Short human label, e.g. "3× daily · 5 days left" / "Once daily · ongoing". */
export function describeSchedule(
  s: Pick<DoseSchedule, "timesPerDay" | "endDate">,
  now: Date = new Date(),
): string {
  const n = clampTimesPerDay(s.timesPerDay);
  const freq = n === 1 ? "Once daily" : `${n}× daily`;
  const left = daysUntilEnd(s, now);
  const tail =
    left == null ? "ongoing" : left === 0 ? "ends today" : `${left} days left`;
  return `${freq} · ${tail}`;
}
