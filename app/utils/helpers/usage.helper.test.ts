import { describe, it, expect } from "vitest";
import { estimateUsage, describeUsage } from "./usage.helper";
import type { UsageLog } from "~/types/storeTypes";

const DAY = 86_400_000;
const NOW = new Date("2026-01-31T00:00:00Z");

function consumed(daysAgo: number, amount = 1): UsageLog {
  return {
    delta: -amount,
    loggedAt: new Date(NOW.getTime() - daysAgo * DAY),
  } as unknown as UsageLog;
}

describe("estimateUsage", () => {
  it("cold-starts food from the type prior ('still learning')", () => {
    const e = estimateUsage(
      { quantity: 10, useRate: null, useRatePeriod: null, itemType: "food" },
      [],
      NOW,
    );
    expect(e.source).toBe("prior");
    expect(e.dailyRate).toBeCloseTo(0.25, 5);
    expect(e.runoutDays).toBe(40); // floor(10 / 0.25)
  });

  it("has no estimate for a non-depleting type with no data", () => {
    const e = estimateUsage(
      { quantity: 5, useRate: null, useRatePeriod: null, itemType: "equipment" },
      [],
      NOW,
    );
    expect(e.source).toBe("none");
    expect(e.dailyRate).toBeNull();
    expect(e.runoutDays).toBeNull();
  });

  it("reports run-out immediately when quantity is zero", () => {
    const e = estimateUsage(
      { quantity: 0, useRate: null, useRatePeriod: null, itemType: "food" },
      [],
      NOW,
    );
    expect(e.runoutDays).toBe(0);
  });

  it("uses a manual rate when given and no history exists", () => {
    const e = estimateUsage(
      { quantity: 14, useRate: 1, useRatePeriod: "week", itemType: "other" },
      [],
      NOW,
    );
    expect(e.source).toBe("manual");
    expect(e.dailyRate).toBeCloseTo(1 / 7, 5);
  });

  it("learns from consumption history, shrunk toward the prior", () => {
    // Four consumptions, 10 days apart → three intervals at 0.1 units/day.
    const logs = [consumed(30), consumed(20), consumed(10), consumed(0)];
    const e = estimateUsage(
      { quantity: 3, useRate: null, useRatePeriod: null, itemType: "food" },
      logs,
      NOW,
    );
    expect(e.source).toBe("history");
    expect(e.confidence).toBe("medium"); // 3 samples (>=2, <4)
    expect(e.events).toBe(4);
    // hist 0.1 shrunk toward prior 0.25: (1.5*0.25 + 3*0.1) / 4.5 = 0.15
    expect(e.dailyRate).toBeCloseTo(0.15, 5);
    // ~floor(3 / 0.15) = 20, allowing for float rounding at the boundary.
    expect(e.runoutDays).toBeGreaterThanOrEqual(19);
    expect(e.runoutDays).toBeLessThanOrEqual(20);
  });
});

describe("describeUsage", () => {
  it("handles missing/empty estimates", () => {
    expect(describeUsage(undefined)).toMatch(/no usage data/i);
  });
  it("labels a prior estimate as still learning", () => {
    const e = estimateUsage(
      { quantity: 10, useRate: null, useRatePeriod: null, itemType: "food" },
      [],
      NOW,
    );
    expect(describeUsage(e)).toMatch(/still learning/i);
  });
});
