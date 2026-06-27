import { describe, it, expect } from "vitest";
import {
  dateKey,
  parseDateKey,
  addDays,
  startOfWeek,
  weekDays,
  isSameDay,
  weekLabel,
} from "./calendar.helper";

describe("calendar date helpers", () => {
  it("round-trips a date key", () => {
    const d = new Date(2026, 5, 23); // 23 Jun 2026 (a Tuesday)
    expect(dateKey(d)).toBe("2026-06-23");
    expect(dateKey(parseDateKey("2026-06-23"))).toBe("2026-06-23");
  });

  it("pads single-digit months and days", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("addDays crosses month boundaries", () => {
    expect(dateKey(addDays(new Date(2026, 5, 30), 2))).toBe("2026-07-02");
    expect(dateKey(addDays(new Date(2026, 5, 1), -1))).toBe("2026-05-31");
  });

  it("startOfWeek returns the Monday", () => {
    // 23 Jun 2026 is a Tuesday → Monday is the 22nd.
    expect(dateKey(startOfWeek(new Date(2026, 5, 23)))).toBe("2026-06-22");
    // A Monday maps to itself.
    expect(dateKey(startOfWeek(new Date(2026, 5, 22)))).toBe("2026-06-22");
    // A Sunday maps back to the prior Monday.
    expect(dateKey(startOfWeek(new Date(2026, 5, 28)))).toBe("2026-06-22");
  });

  it("weekDays yields 7 consecutive days from Monday", () => {
    const days = weekDays(startOfWeek(new Date(2026, 5, 23)));
    expect(days).toHaveLength(7);
    expect(dateKey(days[0])).toBe("2026-06-22");
    expect(dateKey(days[6])).toBe("2026-06-28");
  });

  it("isSameDay ignores time", () => {
    expect(isSameDay(new Date(2026, 5, 23, 9), new Date(2026, 5, 23, 21))).toBe(
      true,
    );
    expect(isSameDay(new Date(2026, 5, 23), new Date(2026, 5, 24))).toBe(false);
  });

  it("weekLabel reads naturally, incl. across months", () => {
    expect(weekLabel(new Date(2026, 5, 22))).toBe("Jun 22 – 28");
    expect(weekLabel(new Date(2026, 5, 29))).toBe("Jun 29 – Jul 5");
  });
});
