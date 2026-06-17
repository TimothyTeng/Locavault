import { describe, it, expect } from "vitest";
import {
  requireText,
  optText,
  optInt,
  toQty,
  optDate,
  oneOf,
} from "./validate.helper";

describe("requireText", () => {
  it("trims and returns non-empty input", () => {
    expect(requireText("  Milk  ", "name")).toBe("Milk");
  });
  it("throws a 400 Response on empty/blank/non-string", () => {
    expect(() => requireText("   ", "name")).toThrow();
    expect(() => requireText("", "name")).toThrow();
    expect(() => requireText(123 as unknown, "name")).toThrow();
  });
  it("caps length", () => {
    expect(requireText("a".repeat(50), "n", 10)).toHaveLength(10);
  });
});

describe("optText", () => {
  it("returns null for nullish/blank", () => {
    expect(optText(null)).toBeNull();
    expect(optText(undefined)).toBeNull();
    expect(optText("   ")).toBeNull();
  });
  it("trims and caps length", () => {
    expect(optText("  hi  ")).toBe("hi");
    expect(optText("a".repeat(30), 10)).toHaveLength(10);
  });
});

describe("optInt", () => {
  it("returns null for nullish/empty/unparseable", () => {
    expect(optInt(null)).toBeNull();
    expect(optInt("")).toBeNull();
    expect(optInt("abc")).toBeNull();
    expect(optInt(NaN)).toBeNull();
  });
  it("rounds and clamps", () => {
    expect(optInt("5")).toBe(5);
    expect(optInt(2.4)).toBe(2);
    expect(optInt(-5, { min: 0 })).toBe(0);
    expect(optInt(999, { max: 100 })).toBe(100);
  });
});

describe("toQty", () => {
  it("falls back when unparseable", () => {
    expect(toQty("abc", 7)).toBe(7);
    expect(toQty(undefined, 1)).toBe(1);
  });
  it("rounds and clamps to bounds", () => {
    expect(toQty("3")).toBe(3);
    expect(toQty(3.7)).toBe(4);
    expect(toQty(-2, 1, { min: 0 })).toBe(0);
    expect(toQty(5_000_000, 1, { max: 1_000_000 })).toBe(1_000_000);
  });
});

describe("optDate", () => {
  it("returns null for falsy or invalid", () => {
    expect(optDate(null)).toBeNull();
    expect(optDate("")).toBeNull();
    expect(optDate("not-a-date")).toBeNull();
  });
  it("parses a valid date string", () => {
    const d = optDate("2026-01-15");
    expect(d).toBeInstanceOf(Date);
    expect(isNaN((d as Date).getTime())).toBe(false);
  });
});

describe("oneOf", () => {
  const allowed = ["day", "week", "month"] as const;
  it("passes through allowed values", () => {
    expect(oneOf("week", allowed, "day")).toBe("week");
  });
  it("falls back on disallowed values", () => {
    expect(oneOf("year", allowed, "day")).toBe("day");
    expect(oneOf(undefined, allowed, "month")).toBe("month");
  });
});
