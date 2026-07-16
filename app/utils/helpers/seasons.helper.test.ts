import { describe, it, expect } from "vitest";
import { currentSeason, seasonRotation } from "./seasons.helper";

// Build dates in LOCAL time (matching the helper's local-calendar math) so the
// day counts are timezone-independent. `(y, mIdx, d)` — month is 0-indexed.
const d = (y: number, mIdx: number, day: number) => new Date(y, mIdx, day);

describe("currentSeason", () => {
  it("buckets months into seasons (N. hemisphere)", () => {
    expect(currentSeason(d(2026, 0, 15))).toBe("winter");
    expect(currentSeason(d(2026, 6, 15))).toBe("summer");
    expect(currentSeason(d(2026, 3, 15))).toBe("transitional");
    expect(currentSeason(d(2026, 9, 15))).toBe("transitional");
    expect(currentSeason(d(2026, 11, 25))).toBe("winter");
  });
});

describe("seasonRotation", () => {
  it("never rotates all/absent/transitional-only seasons", () => {
    const now = d(2026, 4, 20);
    expect(seasonRotation("all", now)).toBeNull();
    expect(seasonRotation(null, now)).toBeNull();
    expect(seasonRotation(undefined, now)).toBeNull();
    expect(seasonRotation("transitional", now)).toBeNull();
  });

  it("nudges to bring summer clothes out ~3 weeks before June 1", () => {
    const r = seasonRotation("summer", d(2026, 4, 20)); // May 20
    expect(r?.action).toBe("surface");
    expect(r?.days).toBe(12);
    expect(r?.phrase).toContain("bring these out");
  });

  it("nudges to pack summer clothes away after Sep 1", () => {
    const r = seasonRotation("summer", d(2026, 8, 10)); // Sep 10
    expect(r?.action).toBe("store");
    expect(r?.phrase).toContain("pack these away");
  });

  it("handles winter's year-end wrap — bring out before Dec 1", () => {
    const r = seasonRotation("winter", d(2026, 10, 20)); // Nov 20
    expect(r?.action).toBe("surface");
    expect(r?.days).toBe(11);
  });

  it("handles winter's pack-away after Mar 1", () => {
    const r = seasonRotation("winter", d(2026, 2, 10)); // Mar 10
    expect(r?.action).toBe("store");
  });

  it("stays quiet mid-season", () => {
    // Deep summer: not near June 1 start nor Sep 1 end windows.
    expect(seasonRotation("summer", d(2026, 6, 15))).toBeNull();
    // Deep winter (January): Dec 1 start long past, Mar 1 end still weeks off.
    expect(seasonRotation("winter", d(2026, 0, 15))).toBeNull();
  });
});
