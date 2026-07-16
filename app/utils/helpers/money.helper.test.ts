import { describe, it, expect } from "vitest";
import {
  formatMoney,
  basketTotal,
  spentCents,
  parseMoneyToCents,
  sumCents,
  bucketSpend,
  periodKey,
  type SpendPoint,
} from "./money.helper";

describe("parseMoneyToCents", () => {
  it("parses dollar-formatted prices", () => {
    expect(parseMoneyToCents("$12.34")).toBe(1234);
    expect(parseMoneyToCents("12.34")).toBe(1234);
    expect(parseMoneyToCents("0.05")).toBe(5);
    expect(parseMoneyToCents("3.49")).toBe(349);
  });
  it("handles comma decimals and thousands separators", () => {
    expect(parseMoneyToCents("12,34")).toBe(1234); // euro-style decimal
    expect(parseMoneyToCents("1,234.56")).toBe(123456); // thousands + decimal
    expect(parseMoneyToCents("1.234,56")).toBe(123456); // continental
  });
  it("treats a bare integer as whole units", () => {
    expect(parseMoneyToCents("12")).toBe(1200);
    expect(parseMoneyToCents("5")).toBe(500);
  });
  it("strips currency symbols and trailing tax codes", () => {
    expect(parseMoneyToCents("£2.00")).toBe(200);
    expect(parseMoneyToCents("4.29 F")).toBe(429);
  });
  it("preserves sign for refunds", () => {
    expect(parseMoneyToCents("-5.00")).toBe(-500);
  });
  it("returns null when there's no number", () => {
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("TOTAL")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats cents as dollars", () => {
    expect(formatMoney(1234)).toBe("$12.34");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(5)).toBe("$0.05");
  });
  it("renders null as an em dash", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });
  it("handles negatives", () => {
    expect(formatMoney(-250)).toBe("-$2.50");
  });
});

describe("basketTotal", () => {
  it("sums cost × quantity in cents, counting priced/unpriced rows", () => {
    const r = basketTotal([
      { cost: 100, quantity: 2 }, // $2.00
      { cost: 50, quantity: 3 }, // $1.50
      { cost: null, quantity: 5 }, // no price
    ]);
    expect(r.cents).toBe(350);
    expect(r.priced).toBe(2);
    expect(r.unpriced).toBe(1);
  });
  it("is zero for an empty basket", () => {
    expect(basketTotal([])).toEqual({ cents: 0, priced: 0, unpriced: 0 });
  });
  it("ignores negative quantities", () => {
    expect(basketTotal([{ cost: 100, quantity: -3 }]).cents).toBe(0);
  });
});

describe("spentCents", () => {
  const cost = new Map<string, number | null>([
    ["a", 200],
    ["b", null],
    ["c", 50],
  ]);
  it("values restocks (positive deltas) at item cost", () => {
    const logs = [
      { itemId: "a", delta: 2 }, // 400
      { itemId: "c", delta: 3 }, // 150
    ];
    expect(spentCents(logs, cost)).toBe(550);
  });
  it("ignores consumption, confirmations, and unpriced items", () => {
    const logs = [
      { itemId: "a", delta: -1 }, // consumption
      { itemId: "a", delta: 0 }, // confirmation
      { itemId: "b", delta: 4 }, // no cost
    ];
    expect(spentCents(logs, cost)).toBe(0);
  });
});

describe("sumCents", () => {
  it("sums, treating null/undefined as 0", () => {
    expect(sumCents([100, 250, null, undefined, 50])).toBe(400);
    expect(sumCents([])).toBe(0);
  });
});

describe("periodKey", () => {
  const d = new Date(2026, 2, 5); // 2026-03-05 (local)
  it("keys by month/day", () => {
    expect(periodKey(d, "month")).toBe("2026-03");
    expect(periodKey(d, "day")).toBe("2026-03-05");
  });
  it("keys by ISO week", () => {
    // 2026-01-01 is a Thursday → ISO week 1 of 2026.
    expect(periodKey(new Date(2026, 0, 1), "week")).toBe("2026-W01");
    // 2025-12-29 (Mon) belongs to ISO week 1 of 2026.
    expect(periodKey(new Date(2025, 11, 29), "week")).toBe("2026-W01");
  });
});

describe("bucketSpend", () => {
  const rows: SpendPoint[] = [
    { costCents: 500, loggedAt: new Date(2026, 0, 10) }, // Jan
    { costCents: 250, loggedAt: new Date(2026, 0, 20) }, // Jan
    { costCents: 900, loggedAt: new Date(2026, 1, 3) }, // Feb
    { costCents: null, loggedAt: new Date(2026, 1, 5) }, // skipped (no cost)
    { costCents: 100, loggedAt: null }, // skipped (no date)
  ];

  it("buckets by month and sums, in chronological order", () => {
    expect(bucketSpend(rows, "month")).toEqual([
      { key: "2026-01", cents: 750 },
      { key: "2026-02", cents: 900 },
    ]);
  });

  it("skips rows lacking a cost or timestamp", () => {
    const total = bucketSpend(rows, "month").reduce((s, b) => s + b.cents, 0);
    expect(total).toBe(1650);
  });

  it("returns [] for empty input", () => {
    expect(bucketSpend([], "day")).toEqual([]);
  });
});
