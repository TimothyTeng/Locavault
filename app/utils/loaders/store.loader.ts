import { getAuth } from "@clerk/react-router/server";
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import {
  createInvite,
  createItem,
  createItems,
  createItemLog,
  createPurchaseOrder,
  deleteItem,
  deletePurchaseOrder,
  getUsageLogsByStore,
  getItemById,
  getItemsByStore,
  getMembersByStore,
  getPurchaseOrderById,
  getPurchaseOrders,
  removeMember,
  updateItem,
  updateItemVisibility,
  updatePurchaseOrder,
  updateStoreVisibility,
  verifyStoreAccess,
} from "~/lib/queries";
import { estimateUsage } from "~/utils/helpers/usage.helper";
import type { UsageLog } from "~/types/storeTypes";

/** Window of consumption history (days) pulled to estimate usage. */
const USAGE_WINDOW_DAYS = 120;

/**
 * Commit a single purchase-order row to inventory:
 * - linked item → add its quantity to the existing item
 * - unlinked    → create a fresh item
 * Then delete the PO row. Returns false if the row/linked item is missing.
 */
async function commitPurchaseOrderRow(
  poId: string,
  loggedBy?: string,
): Promise<boolean> {
  const poRow = await getPurchaseOrderById(poId);
  if (!poRow) return false;

  if (poRow.itemId) {
    const existing = await getItemById(poRow.itemId);
    if (!existing) return false;
    await updateItem(poRow.itemId, {
      name: poRow.name,
      quantity: existing.quantity + poRow.quantity,
      storeId: poRow.storeId,
      blockId: poRow.blockId ?? undefined,
      description: poRow.description ?? undefined,
      sku: poRow.sku ?? undefined,
      unit: poRow.unit ?? undefined,
      minQuantity: poRow.minQuantity ?? undefined,
      cost: poRow.cost ?? undefined,
      expiryDate: poRow.expiryDate ?? undefined,
      useRate: poRow.useRate ?? undefined,
      useRatePeriod: poRow.useRatePeriod ?? undefined,
    });
    // Record the restock (positive delta) so usage history stays complete.
    if (poRow.quantity > 0) {
      await createItemLog(
        poRow.itemId,
        poRow.storeId,
        poRow.quantity,
        loggedBy,
        "restock",
      );
    }
  } else {
    await createItem({
      name: poRow.name,
      quantity: poRow.quantity,
      storeId: poRow.storeId,
      blockId: poRow.blockId ?? undefined,
      description: poRow.description ?? undefined,
      sku: poRow.sku ?? undefined,
      unit: poRow.unit ?? undefined,
      minQuantity: poRow.minQuantity ?? undefined,
      cost: poRow.cost ?? undefined,
      expiryDate: poRow.expiryDate ?? undefined,
      useRate: poRow.useRate ?? undefined,
      useRatePeriod: poRow.useRatePeriod ?? undefined,
    });
  }

  await deletePurchaseOrder(poRow.id);
  return true;
}

export const loader = async (args: LoaderFunctionArgs) => {
  const { userId } = await getAuth(args);
  const { params } = args;

  const access = await verifyStoreAccess(params.id!, userId ?? null);

  if (!access) throw redirect("/");

  const { store, accessLevel } = access;

  if (accessLevel === "none") throw redirect("/");

  const usageSince = new Date(Date.now() - USAGE_WINDOW_DAYS * 86_400_000);
  const [allItems, purchaseOrders, members, usageLogs] = await Promise.all([
    getItemsByStore(params.id!),
    getPurchaseOrders(params.id!),
    accessLevel === "owner"
      ? getMembersByStore(params.id!)
      : Promise.resolve([]),
    getUsageLogsByStore(params.id!, usageSince),
  ]);

  // Group usage logs by item so usage can be estimated in one pass.
  const logsByItem = new Map<string, UsageLog[]>();
  for (const log of usageLogs) {
    const arr = logsByItem.get(log.itemId);
    if (arr) arr.push(log);
    else logsByItem.set(log.itemId, [log]);
  }

  const visibleItems =
    accessLevel === "public" || accessLevel === "viewer"
      ? allItems.filter((i) => i.isPublic)
      : allItems;

  const now = new Date();
  const items = visibleItems.map((item) => ({
    ...item,
    usage: estimateUsage(item, logsByItem.get(item.id) ?? [], now),
  }));

  return { accessLevel, store, items, members, userId, purchaseOrders };
};

// ── Action ─────────────────────────────────────────────────
export const action = async (args: ActionFunctionArgs) => {
  const { request, params } = args;
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  // Authorize against THIS store, not just "is signed in". Every mutation below
  // requires edit access (owner/editor); member, invite and visibility changes
  // are owner-only. Never trust the client to have scoped itself correctly.
  const access = await verifyStoreAccess(params.id!, userId);
  if (!access) throw new Response("Store not found", { status: 404 });
  const canEdit =
    access.accessLevel === "owner" || access.accessLevel === "editor";
  const isOwner = access.accessLevel === "owner";
  if (!canEdit) throw new Response("Forbidden", { status: 403 });

  const data = await request.json();

  if (data._action === "createItem") {
    const newItem = await createItem({
      name: data.name,
      storeId: params.id!,
      quantity: data.quantity,
      description: data.description,
      blockId: data.blockId ?? undefined,
      itemType: data.itemType ?? undefined,
      sku: data.sku ?? undefined,
      unit: data.unit ?? undefined,
      minQuantity: data.minQuantity ?? undefined,
      cost: data.cost ?? undefined,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      useRate: data.useRate ?? undefined,
      useRatePeriod: data.useRatePeriod ?? undefined,
    });
    return { ok: true, id: newItem.id, optimisticId: data.optimisticId };
  }

  if (data._action === "createItems") {
    const rows = Array.isArray(data.items) ? data.items : [];
    const ids = await createItems(
      rows.map((r: any) => ({
        name: r.name,
        storeId: params.id!,
        quantity: r.quantity ?? 1,
        blockId: r.blockId ?? undefined,
        itemType: r.itemType ?? undefined,
        unit: r.unit ?? undefined,
      })),
    );
    return {
      ok: true,
      created: rows.map((r: any, i: number) => ({
        optimisticId: r.optimisticId,
        id: ids[i],
      })),
    };
  }

  if (data._action === "updateItem") {
    // Capture the quantity change as a usage log so predictions can learn.
    const prev = await getItemById(data.id);
    await updateItem(data.id, {
      name: data.name,
      quantity: data.quantity,
      description: data.description,
      storeId: data.storeId,
      blockId: data.blockId,
      ...(data.itemType ? { itemType: data.itemType } : {}),
      sku: data.sku ?? null,
      unit: data.unit ?? null,
      minQuantity: data.minQuantity ?? null,
      cost: data.cost ?? null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      useRate: data.useRate ?? null,
      useRatePeriod: data.useRatePeriod ?? null,
    });
    if (prev && typeof data.quantity === "number") {
      const delta = data.quantity - prev.quantity;
      if (delta !== 0) {
        await createItemLog(
          data.id,
          data.storeId ?? params.id!,
          delta,
          userId,
          "edit",
        );
      }
    }
    return { ok: true };
  }

  if (data._action === "deleteItem") {
    await deleteItem(data.id);
    return { ok: true };
  }

  // One-tap "we're out": the sanctioned outflow signal. Zero the quantity, log
  // the depletion (a strong calibration point for usage prediction), and queue a
  // restock on the shopping list if one isn't already there.
  if (data._action === "markItemOut") {
    const item = await getItemById(data.id);
    if (!item) return { ok: false };
    if (item.quantity > 0) {
      await createItemLog(item.id, item.storeId, -item.quantity, userId, "out");
      await updateItem(item.id, { quantity: 0 });
    }
    const existing = await getPurchaseOrders(params.id!);
    if (!existing.some((p) => p.itemId === item.id)) {
      const fallback =
        item.minQuantity != null ? Math.max(item.minQuantity * 2, 1) : 1;
      await createPurchaseOrder({
        itemId: item.id,
        storeId: item.storeId,
        name: item.name,
        quantity: Number(data.restockQty) || fallback,
        blockId: item.blockId ?? null,
        description: item.description ?? null,
        sku: item.sku ?? null,
        unit: item.unit ?? null,
        minQuantity: item.minQuantity ?? null,
        cost: item.cost ?? null,
        expiryDate: null,
        useRate: item.useRate ?? null,
        useRatePeriod: item.useRatePeriod ?? null,
        createdBy: userId ?? null,
      });
    }
    return { ok: true };
  }

  if (data._action === "removeMember") {
    if (!isOwner) throw new Response("Forbidden", { status: 403 });
    await removeMember(params.id!, data.userId);
    return { ok: true };
  }

  if (data._action === "createInvite") {
    if (!isOwner) throw new Response("Forbidden", { status: 403 });
    const token = await createInvite(params.id!, "editor", userId);
    return { ok: true, token };
  }

  if (data._action === "updateVisibility") {
    if (!isOwner) throw new Response("Forbidden", { status: 403 });
    await updateStoreVisibility(params.id!, {
      isPublic: data.isPublic,
      canvasVisible: data.canvasVisible,
    });
    return { ok: true };
  }

  if (data._action === "updateItemVisibility") {
    await updateItemVisibility(data.itemId, data.isPublic);
    return { ok: true };
  }

  if (data._action === "createPOItem") {
  const row = await createPurchaseOrder({
    itemId: data.itemId ?? null,
    storeId:params.id!,
    name: data.name,
    quantity: Number(data.quantity),
    blockId: data.blockId ?? null,
    description: data.description ?? null,
    sku: data.sku ?? null,
    unit: data.unit ?? null,
    minQuantity: data.minQuantity ? Number(data.minQuantity) : null,
    cost: data.cost ? Number(data.cost) : null,
    expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
    useRate: data.useRate ? Number(data.useRate) : null,
    useRatePeriod: data.useRatePeriod ?? null,
    createdBy: userId ?? null,
  });
  return { ok: true, id: row.id, optimisticId: data.optimisticId };
}

if (data._action === "createPOItems") {
  const rows = Array.isArray(data.items) ? data.items : [];
  for (const r of rows) {
    await createPurchaseOrder({
      itemId: r.itemId ?? null,
      storeId: params.id!,
      name: r.name,
      quantity: Number(r.quantity) || 1,
      blockId: r.blockId ?? null,
      description: r.description ?? null,
      sku: r.sku ?? null,
      unit: r.unit ?? null,
      minQuantity: r.minQuantity != null ? Number(r.minQuantity) : null,
      cost: r.cost != null ? Number(r.cost) : null,
      expiryDate: r.expiryDate ? new Date(r.expiryDate) : null,
      useRate: r.useRate != null ? Number(r.useRate) : null,
      useRatePeriod: r.useRatePeriod ?? null,
      createdBy: userId ?? null,
    });
  }
  return { ok: true };
}

if (data._action === "updatePOItem") {
  await updatePurchaseOrder(data.id, {
    name: data.name,
    quantity: Number(data.quantity),
    blockId: data.blockId ?? null,
    description: data.description ?? null,
    sku: data.sku ?? null,
    unit: data.unit ?? null,
    minQuantity: data.minQuantity ? Number(data.minQuantity) : null,
    cost: data.cost ? Number(data.cost) : null,
    expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
    useRate: data.useRate ? Number(data.useRate) : null,
    useRatePeriod: data.useRatePeriod ?? null,
  });
  return { ok: true };
}

if (data._action === "deletePOItem") {
  await deletePurchaseOrder(data.id);
  return { ok: true };
}

if (data._action === "buyPOItem") {
  const ok = await commitPurchaseOrderRow(data.id, userId);
  return { ok, optimisticId: data.optimisticId };
}

if (data._action === "buyPOItems") {
  const ids: string[] = Array.isArray(data.ids) ? data.ids : [];
  let committed = 0;
  for (const id of ids) {
    if (await commitPurchaseOrderRow(id, userId)) committed++;
  }
  return { ok: true, committed };
}

  return { ok: false };
};