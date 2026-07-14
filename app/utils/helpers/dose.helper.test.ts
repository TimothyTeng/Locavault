import { describe, it, expect } from "vitest";
import {
  clampTimesPerDay,
  doseSlotHours,
  slotsElapsed,
  scheduleActive,
  dosesDueNow,
  nextSlotHour,
  formatHour,
  daysUntilEnd,
  describeSchedule,
} from "./dose.helper";

// Local-time constructor so getHours() matches the intended slot times.
const at = (h: number, m = 0) => new Date(2026, 2, 15, h, m); // Mar 15 2026, local
const day = (offset: number) => new Date(2026, 2, 15 + offset);

const sched = (over: Partial<Parameters<typeof dosesDueNow>[0]> = {}) => ({
  active: true,
  startDate: day(-2),
  endDate: null as Date | null,
  timesPerDay: 2,
  ...over,
});

describe("clampTimesPerDay", () => {
  it("bounds to 1–4 and floors", () => {
    expect(clampTimesPerDay(0)).toBe(1);
    expect(clampTimesPerDay(5)).toBe(4);
    expect(clampTimesPerDay(2.9)).toBe(2);
    expect(clampTimesPerDay(NaN)).toBe(1);
  });
});

describe("doseSlotHours", () => {
  it("centres slots in the waking window", () => {
    expect(doseSlotHours(1)).toEqual([15]);
    expect(doseSlotHours(2)).toEqual([11.5, 18.5]);
    const three = doseSlotHours(3);
    expect(three[1]).toBeCloseTo(15, 5);
    expect(three).toHaveLength(3);
  });
});

describe("slotsElapsed", () => {
  it("counts slots whose time has passed", () => {
    expect(slotsElapsed(2, at(9))).toBe(0); // before 11:30
    expect(slotsElapsed(2, at(12))).toBe(1); // after 11:30, before 18:30
    expect(slotsElapsed(2, at(19))).toBe(2); // after both
  });
});

describe("scheduleActive", () => {
  it("respects the active flag and date bounds", () => {
    const now = at(12);
    expect(scheduleActive(sched(), now)).toBe(true);
    expect(scheduleActive(sched({ active: false }), now)).toBe(false);
    expect(scheduleActive(sched({ startDate: day(1) }), now)).toBe(false); // not started
    expect(scheduleActive(sched({ endDate: day(-1) }), now)).toBe(false); // ended
    expect(scheduleActive(sched({ endDate: day(0) }), now)).toBe(true); // ends today = still active
  });
});

describe("dosesDueNow", () => {
  it("is slots-elapsed minus taken, clamped at zero", () => {
    expect(dosesDueNow(sched(), 0, at(12))).toBe(1); // 1 elapsed, 0 taken
    expect(dosesDueNow(sched(), 1, at(12))).toBe(0); // caught up
    expect(dosesDueNow(sched(), 1, at(19))).toBe(1); // 2 elapsed, 1 taken
    expect(dosesDueNow(sched(), 5, at(19))).toBe(0); // over-taken never negative
  });
  it("is zero when the schedule isn't active today", () => {
    expect(dosesDueNow(sched({ active: false }), 0, at(19))).toBe(0);
    expect(dosesDueNow(sched({ endDate: day(-1) }), 0, at(19))).toBe(0);
  });
});

describe("nextSlotHour", () => {
  it("finds the next upcoming slot, or null once all passed", () => {
    expect(nextSlotHour(2, at(9))).toBe(11.5);
    expect(nextSlotHour(2, at(12))).toBe(18.5);
    expect(nextSlotHour(2, at(20))).toBeNull();
  });
});

describe("formatHour", () => {
  it("formats decimal hours as am/pm", () => {
    expect(formatHour(15)).toBe("3pm");
    expect(formatHour(8)).toBe("8am");
    expect(formatHour(12)).toBe("12pm");
    expect(formatHour(11.5)).toBe("11:30am");
    expect(formatHour(20.25)).toBe("8:15pm");
  });
});

describe("daysUntilEnd / describeSchedule", () => {
  it("counts days to the end date", () => {
    expect(daysUntilEnd({ endDate: null }, at(12))).toBeNull();
    expect(daysUntilEnd({ endDate: day(5) }, at(12))).toBe(5);
    expect(daysUntilEnd({ endDate: day(-3) }, at(12))).toBe(0);
  });
  it("describes frequency + remaining", () => {
    expect(describeSchedule({ timesPerDay: 1, endDate: null }, at(12))).toBe(
      "Once daily · ongoing",
    );
    expect(describeSchedule({ timesPerDay: 3, endDate: day(5) }, at(12))).toBe(
      "3× daily · 5 days left",
    );
    expect(describeSchedule({ timesPerDay: 2, endDate: day(0) }, at(12))).toBe(
      "2× daily · ends today",
    );
  });
});
