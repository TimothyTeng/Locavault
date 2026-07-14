import { describe, it, expect } from "vitest";
import {
  estimateUsage,
  describeUsage,
  describeRunout,
  describeRunoutRange,
  runoutBucket,
  needsRunoutConfirm,
  suggestRestockQty,
  PERIOD_DAYS,
} from "./usage.helper";
import type { UsageLog } from "~/types/storeTypes";

const DAY = 86_400_000;
const NOW = new Date("2026-01-31T00:00:00Z");

function consumed(daysAgo: number, amount = 1): UsageLog {
  return {
    delta: -amount,
    loggedAt: new Date(NOW.getTime() - daysAgo * DAY),
  } as unknown as UsageLog;
}
function restocked(daysAgo: number, amount = 1): UsageLog {
  return {
    delta: amount,
    loggedAt: new Date(NOW.getTime() - daysAgo * DAY),
  } as unknown as UsageLog;
}
function confirmed(daysAgo: number): UsageLog {
  return {
    delta: 0,
    note: "confirmed",
    loggedAt: new Date(NOW.getTime() - daysAgo * DAY),
  } as unknown as UsageLog;
}

describe("estimateUsage — point estimate", () => {
  it("cold-starts food from the type prior ('still learning')", () => {
    const e = estimateUsage(
      { quantity: 10, useRate: null, useRatePeriod: null, itemType: "food" },
      [],
      NOW,
    );
    expect(e.source).toBe("prior");
    expect(e.dailyRate).toBeCloseTo(0.25, 5); // posterior with no evidence = prior
    expect(e.runoutDays).toBe(40); // floor(10 / 0.25)
    expect(e.bucket).toBe("learning");
  });

  it("has no estimate for a non-depleting type with no data", () => {
    const e = estimateUsage(
      {
        quantity: 5,
        useRate: null,
        useRatePeriod: null,
        itemType: "equipment",
      },
      [],
      NOW,
    );
    expect(e.source).toBe("none");
    expect(e.dailyRate).toBeNull();
    expect(e.runoutDays).toBeNull();
    expect(e.bucket).toBe("learning");
  });

  it("reports run-out immediately when quantity is zero", () => {
    const e = estimateUsage(
      { quantity: 0, useRate: null, useRatePeriod: null, itemType: "food" },
      [],
      NOW,
    );
    expect(e.runoutDays).toBe(0);
    expect(e.runoutEarly).toBe(0);
    expect(e.runoutLate).toBe(0);
    expect(e.bucket).toBe("out");
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

  it("learns a rate from real consumption history", () => {
    // Four consumptions of 1 unit, 10 days apart → ~0.1 units/day of outflow,
    // pulled up slightly by the food prior.
    const logs = [consumed(30), consumed(20), consumed(10), consumed(0)];
    const e = estimateUsage(
      { quantity: 3, useRate: null, useRatePeriod: null, itemType: "food" },
      logs,
      NOW,
    );
    expect(e.source).toBe("history");
    expect(e.confidence).toBe("high"); // 4 events over >=14d
    expect(e.events).toBe(4);
    expect(e.dailyRate).toBeGreaterThan(0.1);
    expect(e.dailyRate).toBeLessThan(0.25); // between raw outflow and prior
    expect(e.runoutDays).toBeGreaterThanOrEqual(12);
    expect(e.runoutDays).toBeLessThanOrEqual(20);
  });
});

describe("estimateUsage — right-censoring (stockpiler bias fix)", () => {
  it("lengthens the estimate for an item that was restocked then left idle", () => {
    // Restocked 20 days ago, never touched since → the open cycle accrues
    // exposure with zero consumption, dragging the rate below the naive prior.
    const e = estimateUsage(
      { quantity: 5, useRate: null, useRatePeriod: null, itemType: "food" },
      [restocked(20, 5)],
      NOW,
    );
    expect(e.dailyRate).toBeLessThan(0.25); // below the bare prior
    // Naive prior would predict floor(5 / 0.25) = 20 days; censoring pushes it out.
    expect(e.runoutDays).toBeGreaterThan(40);
  });

  it("a big recent consumption raises the rate above the prior", () => {
    const e = estimateUsage(
      { quantity: 4, useRate: null, useRatePeriod: null, itemType: "food" },
      [restocked(20, 10), consumed(0, 10)],
      NOW,
    );
    expect(e.source).toBe("history");
    expect(e.dailyRate).toBeGreaterThan(0.25);
  });
});

describe("estimateUsage — distributional band", () => {
  const cases = [
    estimateUsage(
      { quantity: 10, useRate: null, useRatePeriod: null, itemType: "food" },
      [],
      NOW,
    ),
    estimateUsage(
      { quantity: 3, useRate: null, useRatePeriod: null, itemType: "food" },
      [consumed(30), consumed(20), consumed(10), consumed(0)],
      NOW,
    ),
  ];

  it("keeps p25 <= point <= p75 (monotone quantiles)", () => {
    for (const e of cases) {
      expect(e.runoutEarly).not.toBeNull();
      expect(e.runoutLate).not.toBeNull();
      expect(e.runoutEarly!).toBeLessThanOrEqual(e.runoutDays!);
      expect(e.runoutDays!).toBeLessThanOrEqual(e.runoutLate!);
    }
  });

  it("widens the band when confidence is low (cold start)", () => {
    const cold = cases[0];
    const learned = cases[1];
    const coldSpread = cold.runoutLate! - cold.runoutEarly!;
    const learnedSpread = learned.runoutLate! - learned.runoutEarly!;
    // Relative to the mean, the cold-start band is far wider.
    expect(coldSpread / cold.runoutDays!).toBeGreaterThan(
      learnedSpread / learned.runoutDays!,
    );
  });
});

describe("runoutBucket boundaries", () => {
  const bucketOf = (runoutDays: number) =>
    runoutBucket({
      dailyRate: 1,
      source: "history",
      confidence: "high",
      runoutDays,
      runoutDate: null,
      runoutEarly: Math.max(0, runoutDays - 1),
      runoutLate: runoutDays + 1,
      bucket: "learning",
      events: 5,
      windowDays: 30,
    });

  it("maps day counts to buckets", () => {
    expect(bucketOf(0)).toBe("out");
    expect(bucketOf(2)).toBe("days");
    expect(bucketOf(6)).toBe("this_week");
    expect(bucketOf(12)).toBe("next_week");
    expect(bucketOf(40)).toBe("later");
  });

  it("reports 'learning' when the band is wide and confidence low", () => {
    expect(
      runoutBucket({
        dailyRate: 0.1,
        source: "history",
        confidence: "low",
        runoutDays: 30,
        runoutDate: null,
        runoutEarly: 4,
        runoutLate: 90,
        bucket: "learning",
        events: 1,
        windowDays: 5,
      }),
    ).toBe("learning");
  });

  it("still warns on imminent run-out even when uncertain", () => {
    expect(
      runoutBucket({
        dailyRate: 1,
        source: "prior",
        confidence: "low",
        runoutDays: 2,
        runoutDate: null,
        runoutEarly: 1,
        runoutLate: 9,
        bucket: "learning",
        events: 0,
        windowDays: 0,
      }),
    ).toBe("days");
  });
});

describe("the confirm loop", () => {
  const learned = () => [consumed(24), consumed(16), consumed(8), consumed(0)];

  it("'still have it' confirmations lengthen the estimate (censoring)", () => {
    const base = estimateUsage(
      { quantity: 2, useRate: null, useRatePeriod: null, itemType: "food" },
      learned(),
      NOW,
    );
    const withConfirm = estimateUsage(
      { quantity: 2, useRate: null, useRatePeriod: null, itemType: "food" },
      [...learned(), confirmed(0)],
      NOW,
    );
    expect(withConfirm.dailyRate!).toBeLessThan(base.dailyRate!);
    expect(withConfirm.runoutDays!).toBeGreaterThan(base.runoutDays!);
  });

  it("asks once a history-based prediction has passed and stock remains", () => {
    const est = {
      source: "history" as const,
      runoutDate: new Date(NOW.getTime() - 2 * DAY),
    };
    expect(needsRunoutConfirm({ quantity: 3 }, est, [], NOW)).toBe(true);
  });

  it("does not ask when already out, still in the future, or only a prior", () => {
    const past = new Date(NOW.getTime() - 2 * DAY);
    const future = new Date(NOW.getTime() + 5 * DAY);
    expect(
      needsRunoutConfirm(
        { quantity: 0 },
        { source: "history", runoutDate: past },
        [],
        NOW,
      ),
    ).toBe(false);
    expect(
      needsRunoutConfirm(
        { quantity: 3 },
        { source: "history", runoutDate: future },
        [],
        NOW,
      ),
    ).toBe(false);
    expect(
      needsRunoutConfirm(
        { quantity: 3 },
        { source: "prior", runoutDate: past },
        [],
        NOW,
      ),
    ).toBe(false);
  });

  it("stays silent for the rest of the cycle after one answer", () => {
    const past = new Date(NOW.getTime() - 2 * DAY);
    const est = { source: "history" as const, runoutDate: past };
    // answered (confirmed) 1 day ago, no restock since → silenced
    expect(needsRunoutConfirm({ quantity: 3 }, est, [confirmed(1)], NOW)).toBe(
      false,
    );
    // but a restock after that confirmation opens a new cycle → asks again
    expect(
      needsRunoutConfirm(
        { quantity: 3 },
        est,
        [confirmed(3), restocked(1, 5)],
        NOW,
      ),
    ).toBe(true);
  });
});

describe("suggestRestockQty", () => {
  it("covers ~30d of a learned rate", () => {
    expect(
      suggestRestockQty({ quantity: 2, minQuantity: null }, { dailyRate: 0.5 }),
    ).toBe(13); // ceil(0.5*30) - 2
  });
  it("refills to ~2x min when there's no rate", () => {
    expect(suggestRestockQty({ quantity: 1, minQuantity: 3 }, null)).toBe(5);
  });
  it("never suggests less than one", () => {
    expect(suggestRestockQty({ quantity: 0, minQuantity: null })).toBe(1);
  });
});

describe("describe helpers", () => {
  it("handles missing/empty estimates", () => {
    expect(describeUsage(undefined)).toMatch(/no usage data/i);
    expect(describeRunout(undefined)).toMatch(/still learning/i);
    expect(describeRunoutRange(undefined)).toMatch(/not enough data/i);
  });
  it("labels a prior estimate as still learning", () => {
    const e = estimateUsage(
      { quantity: 10, useRate: null, useRatePeriod: null, itemType: "food" },
      [],
      NOW,
    );
    expect(describeUsage(e)).toMatch(/still learning/i);
    expect(describeRunout(e)).toBe("Still learning");
  });
  it("gives a p25–p75 range for a learned estimate", () => {
    const e = estimateUsage(
      { quantity: 3, useRate: null, useRatePeriod: null, itemType: "food" },
      [consumed(30), consumed(20), consumed(10), consumed(0)],
      NOW,
    );
    expect(describeRunoutRange(e)).toMatch(/p25–p75/);
  });
});

describe("PERIOD_DAYS", () => {
  it("treats a month as 30 days", () => {
    expect(PERIOD_DAYS.day).toBe(1);
    expect(PERIOD_DAYS.week).toBe(7);
    expect(PERIOD_DAYS.month).toBe(30);
  });
});
