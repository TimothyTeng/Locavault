import { describe, it, expect } from "vitest";
import { monthlySpendSeries } from "./insights.helper";

describe("monthlySpendSeries", () => {
  const now = new Date(2026, 2, 15); // 2026-03-15

  it("returns exactly N months, oldest → newest, ending at now's month", () => {
    const s = monthlySpendSeries([], 6, now);
    expect(s).toHaveLength(6);
    expect(s[0].key).toBe("2025-10");
    expect(s[5].key).toBe("2026-03");
    expect(s.map((p) => p.label)).toEqual([
      "Oct",
      "Nov",
      "Dec",
      "Jan",
      "Feb",
      "Mar",
    ]);
  });

  it("fills absent months with 0 and places known buckets", () => {
    const s = monthlySpendSeries(
      [
        { key: "2026-01", cents: 500 },
        { key: "2026-03", cents: 1200 },
        { key: "2020-01", cents: 999 }, // outside window → ignored
      ],
      6,
      now,
    );
    const byKey = Object.fromEntries(s.map((p) => [p.key, p.cents]));
    expect(byKey["2026-01"]).toBe(500);
    expect(byKey["2026-02"]).toBe(0);
    expect(byKey["2026-03"]).toBe(1200);
    expect(byKey["2025-11"]).toBe(0);
  });

  it("crosses a year boundary correctly", () => {
    const s = monthlySpendSeries([], 3, new Date(2026, 0, 5)); // Jan 2026
    expect(s.map((p) => p.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});
