import { describe, it, expect } from "vitest";
import {
  warrantyDaysLeft,
  maintenanceDueDays,
  describeMaintenance,
} from "./durable.helper";

const now = new Date(2026, 5, 15); // 2026-06-15
const daysFromNow = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe("warrantyDaysLeft", () => {
  it("counts whole days until expiry, negative once past", () => {
    expect(warrantyDaysLeft({ warrantyUntil: daysFromNow(30) }, now)).toBe(30);
    expect(warrantyDaysLeft({ warrantyUntil: daysFromNow(-5) }, now)).toBe(-5);
  });
  it("is null with no warranty", () => {
    expect(warrantyDaysLeft({}, now)).toBeNull();
    expect(warrantyDaysLeft({ warrantyUntil: null }, now)).toBeNull();
  });
});

describe("maintenanceDueDays", () => {
  it("counts from the last service", () => {
    expect(
      maintenanceDueDays(
        { maintenanceIntervalDays: 90, lastMaintainedAt: daysFromNow(-30) },
        now,
      ),
    ).toBe(60);
  });
  it("goes negative when overdue", () => {
    expect(
      maintenanceDueDays(
        { maintenanceIntervalDays: 30, lastMaintainedAt: daysFromNow(-45) },
        now,
      ),
    ).toBe(-15);
  });
  it("falls back to createdAt when never serviced", () => {
    expect(
      maintenanceDueDays(
        { maintenanceIntervalDays: 100, createdAt: daysFromNow(-10) },
        now,
      ),
    ).toBe(90);
  });
  it("is null without a valid cadence or base date", () => {
    expect(maintenanceDueDays({ maintenanceIntervalDays: 0 }, now)).toBeNull();
    expect(maintenanceDueDays({ maintenanceIntervalDays: 30 }, now)).toBeNull();
    expect(maintenanceDueDays({}, now)).toBeNull();
  });
});

describe("describeMaintenance", () => {
  it("flags overdue and due-today as overdue", () => {
    expect(
      describeMaintenance(
        { maintenanceIntervalDays: 10, lastMaintainedAt: daysFromNow(-20) },
        now,
      ),
    ).toEqual({ text: "Service overdue by 10d", overdue: true });
    expect(
      describeMaintenance(
        { maintenanceIntervalDays: 10, lastMaintainedAt: daysFromNow(-10) },
        now,
      ),
    ).toEqual({ text: "Service due today", overdue: true });
  });
  it("shows soon vs comfortably-serviced windows", () => {
    expect(
      describeMaintenance(
        { maintenanceIntervalDays: 30, lastMaintainedAt: daysFromNow(-20) },
        now,
      ),
    ).toEqual({ text: "Service in 10d", overdue: false });
    expect(
      describeMaintenance(
        { maintenanceIntervalDays: 90, lastMaintainedAt: daysFromNow(-10) },
        now,
      ),
    ).toEqual({ text: "Serviced — next in 80d", overdue: false });
  });
  it("is null when no cadence", () => {
    expect(describeMaintenance({}, now)).toBeNull();
  });
});
