import type { LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth";
import {
  getStoresByUserWithDetails,
  getStoresMemberOf,
  getItemsByStores,
  getUsageLogsByStores,
  getDoseSchedulesByUser,
  getTodayDoseCounts,
} from "~/lib/queries";
import { estimateUsage } from "~/utils/helpers/usage.helper";
import {
  getItemStatus,
  itemRunoutDays,
} from "~/utils/helpers/storeTable.helper";
import { expiryDateRemainingDays } from "~/utils/helpers/store.helper";
import { dosesDueNow, scheduleActive } from "~/utils/helpers/dose.helper";
import type { Item, UsageLog } from "~/types/storeTypes";
import type {
  DoseScheduleView,
  ReminderItem,
  RemindersData,
} from "~/types/doseTypes";

const USAGE_WINDOW_DAYS = 120;

/**
 * The cross-store reminders surface (DESIGN.md §4/§6): dose schedules due today,
 * medications running low (refill soon), and medications expiring. Read-only —
 * Take/Snooze post to /api/doses. Reuses the home-loader aggregation.
 */
export async function loader(args: LoaderFunctionArgs) {
  const userId = await requireAuth(args);

  const [ownedStores, memberStores] = await Promise.all([
    getStoresByUserWithDetails(userId),
    getStoresMemberOf(userId),
  ]);
  const stores = [...ownedStores, ...memberStores];
  const storeIds = stores.map((s) => s.id);
  const storeName = new Map(stores.map((s) => [s.id, s.name]));

  const now = new Date();
  const since = new Date(now.getTime() - USAGE_WINDOW_DAYS * 86_400_000);

  const [rawItems, logs, schedules] = await Promise.all([
    storeIds.length ? getItemsByStores(storeIds) : Promise.resolve([]),
    storeIds.length
      ? getUsageLogsByStores(storeIds, since)
      : Promise.resolve([]),
    getDoseSchedulesByUser(userId),
  ]);

  // Doses taken today (local midnight → now), per scheduled item.
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taken = await getTodayDoseCounts(
    schedules.map((s) => s.itemId),
    todayStart,
  );

  const doses: DoseScheduleView[] = schedules
    .filter((s) => scheduleActive(s, now))
    .map((s) => {
      const takenToday = taken.get(s.itemId) ?? 0;
      return {
        id: s.id,
        itemId: s.itemId,
        userId: s.userId,
        timesPerDay: s.timesPerDay,
        startDate: s.startDate,
        endDate: s.endDate,
        active: s.active,
        createdAt: s.createdAt,
        itemName: s.itemName,
        storeId: s.storeId,
        storeName: storeName.get(s.storeId) ?? s.storeName,
        quantity: s.quantity,
        unit: s.unit,
        takenToday,
        dueCount: dosesDueNow(s, takenToday, now),
      };
    })
    // Due first, then by soonest cadence.
    .sort((a, b) => b.dueCount - a.dueCount);

  const dueCount = doses.reduce((n, d) => n + (d.dueCount > 0 ? 1 : 0), 0);

  // Refill-soon + expiring, medications only (usage-estimated, snooze-aware).
  const logsByItem = new Map<string, UsageLog[]>();
  for (const l of logs) {
    const arr = logsByItem.get(l.itemId) ?? [];
    arr.push({ delta: l.delta, loggedAt: l.loggedAt as Date, note: l.note });
    logsByItem.set(l.itemId, arr);
  }

  const refill: ReminderItem[] = [];
  const expiring: ReminderItem[] = [];
  for (const raw of rawItems) {
    if (raw.itemType !== "medication") continue;
    const usage = estimateUsage(raw as Item, logsByItem.get(raw.id) ?? [], now);
    const item = { ...raw, usage } as Item;
    const status = getItemStatus(item);
    const entry: ReminderItem = {
      id: raw.id,
      name: raw.name,
      storeId: raw.storeId,
      storeName: storeName.get(raw.storeId) ?? "Store",
      quantity: raw.quantity,
      unit: raw.unit ?? null,
      runoutDays: itemRunoutDays(item),
      expiryDays: expiryDateRemainingDays(raw.expiryDate),
    };
    if (status === "low" || status === "out") refill.push(entry);
    else if (status === "expiring") expiring.push(entry);
  }
  refill.sort((a, b) => (a.runoutDays ?? 9999) - (b.runoutDays ?? 9999));
  expiring.sort((a, b) => (a.expiryDays ?? 9999) - (b.expiryDays ?? 9999));

  return { doses, refill, expiring, dueCount } satisfies RemindersData;
}
