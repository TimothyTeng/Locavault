import { describe, it, expect } from "vitest";
import { convert, normalizeUnit, formatAmount } from "./units";

describe("normalizeUnit", () => {
  it("maps spellings and abbreviations to canonical keys", () => {
    expect(normalizeUnit("Tablespoons")).toBe("tbsp");
    expect(normalizeUnit("tsp.")).toBe("tsp");
    expect(normalizeUnit("grams")).toBe("g");
    expect(normalizeUnit("Kilogram")).toBe("kg");
    expect(normalizeUnit("ml")).toBe("ml");
    expect(normalizeUnit("each")).toBe("pcs");
  });

  it("returns undefined for unknown or empty units", () => {
    expect(normalizeUnit("smidge")).toBeUndefined();
    expect(normalizeUnit("")).toBeUndefined();
    expect(normalizeUnit(null)).toBeUndefined();
  });
});

describe("convert", () => {
  it("converts within the volume dimension", () => {
    expect(convert(1, "tbsp", "tsp")).toBeCloseTo(3, 4);
    expect(convert(1, "l", "ml")).toBeCloseTo(1000, 4);
    expect(convert(2, "cup", "ml")).toBeCloseTo(473.176, 2);
  });

  it("converts within the mass dimension", () => {
    expect(convert(1, "kg", "g")).toBeCloseTo(1000, 4);
    expect(convert(16, "oz", "lb")).toBeCloseTo(1, 2);
  });

  it("returns null across dimensions", () => {
    expect(convert(50, "ml", "g")).toBeNull();
    expect(convert(1, "cup", "kg")).toBeNull();
  });

  it("returns null for unknown units", () => {
    expect(convert(1, "pinch", "ml")).toBeNull();
  });

  it("accepts aliased unit spellings", () => {
    expect(convert(1, "Tablespoon", "milliliters")).toBeCloseTo(14.7868, 3);
  });
});

describe("formatAmount", () => {
  it("trims trailing zeros", () => {
    expect(formatAmount(2.0)).toBe("2");
    expect(formatAmount(2.5)).toBe("2.5");
    expect(formatAmount(0.333333)).toBe("0.33");
  });
});
