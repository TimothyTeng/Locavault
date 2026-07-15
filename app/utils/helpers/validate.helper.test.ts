import { describe, it, expect } from "vitest";
import {
  requireText,
  optText,
  optInt,
  toQty,
  optDate,
  oneOf,
  validateBlocks,
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

describe("validateBlocks", () => {
  const base = {
    block_id: "b1",
    background: "#2d6b44",
    border: "#1f4d30",
    label: "Shelf A",
    x: 2,
    y: 3,
    width: 4,
    height: 1,
    kind: "standard",
    fixture: "shelf",
  };

  it("returns [] for non-array input", () => {
    expect(validateBlocks(null)).toEqual([]);
    expect(validateBlocks("nope")).toEqual([]);
    expect(validateBlocks(undefined)).toEqual([]);
  });

  it("passes a well-formed block through unchanged", () => {
    const [b] = validateBlocks([base]);
    expect(b).toEqual(base);
  });

  it("preserves block_id verbatim (item→block diffing depends on it)", () => {
    const [b] = validateBlocks([{ ...base, block_id: "keep-me-123" }]);
    expect(b.block_id).toBe("keep-me-123");
  });

  it("generates a block_id when missing", () => {
    const [b] = validateBlocks([{ ...base, block_id: undefined }]);
    expect(typeof b.block_id).toBe("string");
    expect(b.block_id.length).toBeGreaterThan(0);
  });

  it("clamps geometry into bounds and rounds", () => {
    const [b] = validateBlocks([
      { ...base, x: -5, y: 9999, width: 0, height: 2.6 },
    ]);
    expect(b.x).toBe(0);
    expect(b.y).toBe(500);
    expect(b.width).toBe(1);
    expect(b.height).toBe(3);
  });

  it("rejects non-hex colours, falling back to #000000", () => {
    const [b] = validateBlocks([
      { ...base, background: "url(evil)", border: "red" },
    ]);
    expect(b.background).toBe("#000000");
    expect(b.border).toBe("#000000");
  });

  it("allow-lists kind and nulls unknown fixtures", () => {
    const [b] = validateBlocks([
      { ...base, kind: "trapdoor", fixture: "a b; drop" },
    ]);
    expect(b.kind).toBe("standard");
    expect(b.fixture).toBeNull();
  });

  it("caps the block count", () => {
    const many = Array.from({ length: 10 }, () => ({ ...base }));
    expect(validateBlocks(many, { maxCount: 3 })).toHaveLength(3);
  });

  it("truncates over-long labels", () => {
    const [b] = validateBlocks([{ ...base, label: "x".repeat(500) }]);
    expect(b.label.length).toBe(120);
  });
});
