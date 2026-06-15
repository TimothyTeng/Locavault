import { getAuth } from "@clerk/react-router/server";
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
  verifyStoreAccess,
  verifyStoreOwner,
} from "~/lib/queries";
import { estimateUsage } from "~/utils/helpers/usage.helper";
import { getItemStatus, itemRunoutDays } from "~/utils/helpers/storeTable.helper";
import { expiryDateRemainingDays } from "~/utils/helpers/store.helper";
import type { Item, ItemStatus, UsageLog } from "~/types/storeTypes";
import type { AttentionItem } from "~/types/dashboardTypes";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const USAGE_WINDOW_DAYS = 120;
const SEVERITY: Record<ItemStatus, number> = { out: 0, low: 1, expiring: 2, ok: 3 };

export async function loader(args: LoaderFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return { stores: [], attention: [] as AttentionItem[] };

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

  return { stores, attention: attention.slice(0, 40) };
}

// ── Action ─────────────────────────────────────────────────

/** Suggested restock quantity: ~30d of a known rate, else refill to ~2× min. */
function suggestQty(item: {
  quantity: number;
  minQuantity: number | null;
  useRate: number | null;
  useRatePeriod: "day" | "week" | "month" | null;
}): number {
  const perDay =
    item.useRate && item.useRatePeriod
      ? item.useRate /
        (item.useRatePeriod === "day" ? 1 : item.useRatePeriod === "week" ? 7 : 30)
      : 0;
  if (perDay > 0) {
    const horizon = Math.ceil(perDay * 30) - item.quantity;
    const minNeed = item.minQuantity != null ? item.minQuantity - item.quantity : 0;
    return Math.max(horizon, minNeed, 1);
  }
  const target = item.minQuantity != null ? item.minQuantity * 2 : 1;
  return Math.max(target - item.quantity, 1);
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
