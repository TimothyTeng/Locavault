import { describe, it, expect } from "vitest";
import {
  describeLogNote,
  describeDelta,
  relativeDay,
} from "./itemHistory.helper";

const NOW = new Date("2026-03-15T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("describeLogNote", () => {
  it("maps known notes to labels", () => {
    expect(describeLogNote("out", -5)).toBe("Marked out");
    expect(describeLogNote("cooked", -1)).toBe("Cooked with");
    expect(describeLogNote("confirmed", 0)).toBe("Confirmed still have");
  });
  it("falls back to the delta sign for unknown/absent notes", () => {
    expect(describeLogNote(null, 3)).toBe("Restocked");
    expect(describeLogNote(null, -3)).toBe("Used");
    expect(describeLogNote(null, 0)).toBe("Updated");
  });
});

describe("describeDelta", () => {
  it("signs the delta and blanks a zero", () => {
    expect(describeDelta(3)).toBe("+3");
    expect(describeDelta(-2)).toBe("−2");
    expect(describeDelta(0)).toBe("");
  });
});

describe("relativeDay", () => {
  it("bins recent dates", () => {
    expect(relativeDay(daysAgo(0), NOW)).toBe("today");
    expect(relativeDay(daysAgo(1), NOW)).toBe("yesterday");
    expect(relativeDay(daysAgo(3), NOW)).toBe("3d ago");
    expect(relativeDay(daysAgo(10), NOW)).toBe("1w ago");
  });
  it("falls back to a calendar date past a month", () => {
    // Locale-agnostic: a month abbreviation and a day number, in either order.
    const s = relativeDay(daysAgo(45), NOW);
    expect(s).toMatch(/[A-Za-z]{3}/);
    expect(s).toMatch(/\d+/);
  });
  it("handles null", () => {
    expect(relativeDay(null, NOW)).toBe("");
  });
});
