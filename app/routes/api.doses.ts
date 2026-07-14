import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import {
  getItemById,
  verifyStoreAccess,
  createItemLog,
  updateItem,
  getDoseScheduleForItem,
  getDoseScheduleById,
  createDoseSchedule,
  updateDoseSchedule,
  deleteDoseSchedule,
  snoozeItemAlert,
} from "~/lib/queries";
import { clampTimesPerDay } from "~/utils/helpers/dose.helper";

/**
 * Dose reminders (resource route, no UI). Client posts JSON with an `_action`
 * discriminator. Every mutation authorises the *item's store* (owner/editor) —
 * the reminders surface is cross-store, so we can't lean on a single store
 * loader's guard. Taking a dose is logged as an itemLogs row (delta −1, note
 * "dose") so refill prediction reuses the usage estimator.
 */

/** Resolve an item + assert the user can edit its store. */
async function authItem(itemId: unknown, userId: string) {
  if (typeof itemId !== "string") return null;
  const item = await getItemById(itemId);
  if (!item) return null;
  const access = await verifyStoreAccess(item.storeId, userId);
  if (
    !access ||
    (access.accessLevel !== "owner" && access.accessLevel !== "editor")
  )
    return null;
  return item;
}

/** GET ?itemId= → the user's dose schedule for that item (or null). */
export async function loader(args: LoaderFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const itemId = new URL(args.request.url).searchParams.get("itemId");
  if (!itemId) return Response.json({ schedule: null });
  const item = await authItem(itemId, userId);
  if (!item) return Response.json({ schedule: null });
  const schedule = await getDoseScheduleForItem(item.id, userId);
  return Response.json({
    schedule: schedule
      ? {
          id: schedule.id,
          timesPerDay: schedule.timesPerDay,
          startDate: schedule.startDate?.toISOString() ?? null,
          endDate: schedule.endDate?.toISOString() ?? null,
          active: schedule.active,
        }
      : null,
  });
}

export async function action(args: ActionFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await args.request.json()) as Record<string, unknown>;
  const act = body._action;

  // Start (or update) a dose schedule on an item.
  if (act === "setSchedule") {
    const item = await authItem(body.itemId, userId);
    if (!item) return Response.json({ error: "forbidden" }, { status: 403 });

    const timesPerDay = clampTimesPerDay(Number(body.timesPerDay ?? 1));
    // Duration: a positive day count → endDate that many days out; else ongoing.
    const days = Number(body.days);
    const endDate =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() + Math.floor(days) * 86_400_000)
        : null;

    const existing = await getDoseScheduleForItem(item.id, userId);
    if (existing) {
      await updateDoseSchedule(existing.id, userId, {
        timesPerDay,
        endDate,
        active: true,
      });
      return Response.json({ ok: true, id: existing.id });
    }
    const row = await createDoseSchedule({
      itemId: item.id,
      userId,
      timesPerDay,
      startDate: new Date(),
      endDate,
    });
    return Response.json({ ok: true, id: row.id });
  }

  // Stop tracking doses for an item.
  if (act === "removeSchedule") {
    const item = await authItem(body.itemId, userId);
    if (!item) return Response.json({ error: "forbidden" }, { status: 403 });
    const existing = await getDoseScheduleForItem(item.id, userId);
    if (existing) await deleteDoseSchedule(existing.id, userId);
    return Response.json({ ok: true });
  }

  // Take a dose now: log −1 (note "dose") and decrement stock (never below 0).
  if (act === "takeDose") {
    // Accept a scheduleId or an itemId.
    let itemId = body.itemId;
    if (typeof body.scheduleId === "string") {
      const s = await getDoseScheduleById(body.scheduleId);
      if (s && s.userId === userId) itemId = s.itemId;
    }
    const item = await authItem(itemId, userId);
    if (!item) return Response.json({ error: "forbidden" }, { status: 403 });
    if (item.quantity > 0) {
      await createItemLog(item.id, item.storeId, -1, userId, "dose");
      await updateItem(item.id, { quantity: item.quantity - 1 });
    }
    return Response.json({ ok: true });
  }

  // Snooze/dismiss an item's alerts for N hours (default 24; 0 clears).
  if (act === "snooze") {
    const item = await authItem(body.itemId, userId);
    if (!item) return Response.json({ error: "forbidden" }, { status: 403 });
    const hours = Number(body.hours);
    const until =
      Number.isFinite(hours) && hours > 0
        ? new Date(Date.now() + hours * 3_600_000)
        : null;
    await snoozeItemAlert(item.id, until);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "bad_action" }, { status: 400 });
}
