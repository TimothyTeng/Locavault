import { getAuth } from "~/lib/auth";
import {
  createPurchaseOrder,
  deleteStore,
  getItemById,
  getItemsByStores,
  getListedItemIds,
  getPurchaseOrders,
  getStoresByUserWithDetails,
  getStoresMemberOf,
  getUsageLogsByStores,
  getDoseSchedulesByUser,
  getTodayDoseCounts,
  getUserRecipes,
  getIncomingOfferCount,
  verifyStoreAccess,
  verifyStoreOwner,
} from "~/lib/queries";
import { dosesDueNow } from "~/utils/helpers/dose.helper";
import { matchRecipes } from "~/utils/helpers/recipes.helper";
import {
  estimateUsage,
  describeRunout,
  suggestRestockQty,
  PERIOD_DAYS,
} from "~/utils/helpers/usage.helper";
import {
  getItemStatus,
  itemRunoutDays,
} from "~/utils/helpers/storeTable.helper";
import { expiryDateRemainingDays } from "~/utils/helpers/store.helper";
import { spentCents } from "~/utils/helpers/money.helper";
import type { Item, ItemStatus, UsageLog } from "~/types/storeTypes";
import type { AttentionItem } from "~/types/dashboardTypes";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const USAGE_WINDOW_DAYS = 120;
const SEVERITY: Record<ItemStatus, number> = {
  out: 0,
  low: 1,
  expiring: 2,
  ok: 3,
};

export async function loader(args: LoaderFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId)
    return {
      stores: [],
      attention: [] as AttentionItem[],
      spentThisMonthCents: 0,
      dosesDue: 0,
      incomingOffers: 0,
    };

  const [ownedStores, memberStores] = await Promise.all([
    getStoresByUserWithDetails(userId),
    getStoresMemberOf(userId),
  ]);

  const stores = [
    ...ownedStores.map((s) => ({ ...s, role: "owner" as const })),
    ...memberStores,
  ];

  // ── Foresight digest: what needs attention across every store ──
  const storeIds = stores.map((s) => s.id);
  const now = new Date();
  const since = new Date(now.getTime() - USAGE_WINDOW_DAYS * 86_400_000);

  const [rawItems, logs, listed] = await Promise.all([
    getItemsByStores(storeIds),
    getUsageLogsByStores(storeIds, since),
    getListedItemIds(storeIds),
  ]);

  const logsByItem = new Map<string, UsageLog[]>();
  for (const l of logs) {
    const arr = logsByItem.get(l.itemId) ?? [];
    arr.push({ delta: l.delta, loggedAt: l.loggedAt as Date });
    logsByItem.set(l.itemId, arr);
  }
  const listedSet = new Set(listed);
  const storeById = new Map(stores.map((s) => [s.id, s]));

  const attention: AttentionItem[] = [];
  for (const raw of rawItems) {
    const usage = estimateUsage(raw as Item, logsByItem.get(raw.id) ?? [], now);
    const item = { ...raw, usage } as Item;
    const status = getItemStatus(item);
    if (status === "ok") continue;

    const st = storeById.get(raw.storeId);
    const zone = raw.blockId
      ? (st?.blocks?.find((b) => b.block_id === raw.blockId)?.label ?? null)
      : null;

    attention.push({
      id: raw.id,
      name: raw.name,
      itemType: raw.itemType,
      quantity: raw.quantity,
      unit: raw.unit ?? null,
      storeId: raw.storeId,
      storeName: st?.name ?? "Store",
      zoneLabel: zone,
      status,
      runoutDays: itemRunoutDays(item),
      runoutPhrase: usage.runoutDays != null ? describeRunout(usage) : null,
      expiryDays: expiryDateRemainingDays(raw.expiryDate),
      onList: listedSet.has(raw.id),
      canAdd: st?.role === "owner" || st?.role === "editor",
    });
  }

  attention.sort((a, b) => {
    if (SEVERITY[a.status] !== SEVERITY[b.status])
      return SEVERITY[a.status] - SEVERITY[b.status];
    const av = a.runoutDays ?? a.expiryDays ?? 9999;
    const bv = b.runoutDays ?? b.expiryDays ?? 9999;
    return av - bv;
  });

  // ── Approximate spend this month: restock logs × item unit cost ──
  const costByItem = new Map<string, number | null>(
    rawItems.map((i) => [i.id, i.cost]),
  );
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLogs = logs.filter(
    (l) => l.loggedAt != null && l.loggedAt >= monthStart,
  );
  const spentThisMonthCents = spentCents(monthLogs, costByItem);

  // Trade offers awaiting the user's response (badge on the /trade nav link).
  const incomingOffers = await getIncomingOfferCount(userId);

  // Doses due today across all the user's tracked medications.
  const schedules = await getDoseSchedulesByUser(userId);
  let dosesDue = 0;
  if (schedules.length) {
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const taken = await getTodayDoseCounts(
      schedules.map((s) => s.itemId),
      todayStart,
    );
    for (const s of schedules) {
      if (dosesDueNow(s, taken.get(s.itemId) ?? 0, now) > 0) dosesDue += 1;
    }
  }

  // ── "What can I cook tonight?" — cookable recipe count per store ──
  const userRecipes = await getUserRecipes(userId);
  const itemsByStore = new Map<string, Item[]>();
  for (const it of rawItems) {
    const arr = itemsByStore.get(it.storeId) ?? [];
    arr.push(it as Item);
    itemsByStore.set(it.storeId, arr);
  }
  const storesWithCookable = stores.map((s) => ({
    ...s,
    cookableCount: matchRecipes(
      itemsByStore.get(s.id) ?? [],
      userRecipes,
    ).filter((m) => m.cookable).length,
  }));

  return {
    stores: storesWithCookable,
    attention: attention.slice(0, 40),
    spentThisMonthCents,
    dosesDue,
    incomingOffers,
  };
}

// ── Action ─────────────────────────────────────────────────

/**
 * Suggested restock quantity for a dashboard add-to-list — the shared
 * `suggestRestockQty` math, fed the item's manual use-rate as the daily rate
 * (this path has no loaded usage estimate).
 */
function suggestQty(item: {
  quantity: number;
  minQuantity: number | null;
  useRate: number | null;
  useRatePeriod: "day" | "week" | "month" | null;
}): number {
  const dailyRate =
    item.useRate && item.useRatePeriod
      ? item.useRate / PERIOD_DAYS[item.useRatePeriod]
      : null;
  return suggestRestockQty(item, { dailyRate });
}

export async function action(args: ActionFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const formData = await args.request.formData();
  const _action = formData.get("_action");

  if (_action === "deleteStore") {
    const storeId = String(formData.get("storeId"));
    await verifyStoreOwner(storeId, userId);
    await deleteStore(storeId);
    return { ok: true };
  }

  if (_action === "addToList") {
    const itemId = String(formData.get("itemId"));
    const storeId = String(formData.get("storeId"));
    const access = await verifyStoreAccess(storeId, userId);
    if (
      !access ||
      (access.accessLevel !== "owner" && access.accessLevel !== "editor")
    ) {
      throw new Response("Forbidden", { status: 403 });
    }
    const item = await getItemById(itemId);
    if (!item || item.storeId !== storeId) return { ok: false };

    // Don't double-add something already on the list.
    const existing = await getPurchaseOrders(storeId);
    if (existing.some((p) => p.itemId === itemId)) return { ok: true };

    await createPurchaseOrder({
      itemId: item.id,
      storeId,
      name: item.name,
      quantity: suggestQty(item),
      blockId: item.blockId,
      description: item.description,
      sku: item.sku,
      unit: item.unit,
      minQuantity: item.minQuantity,
      cost: item.cost,
      useRate: item.useRate,
      useRatePeriod: item.useRatePeriod,
      createdBy: userId,
    });
    return { ok: true };
  }

  throw new Response("Unknown action", { status: 400 });
}
