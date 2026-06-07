import { getAuth } from "@clerk/react-router/server";
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import {
  createInvite,
  createItem,
  createPurchaseOrder,
  deleteItem,
  deletePurchaseOrder,
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

/**
 * Commit a single purchase-order row to inventory:
 * - linked item → add its quantity to the existing item
 * - unlinked    → create a fresh item
 * Then delete the PO row. Returns false if the row/linked item is missing.
 */
async function commitPurchaseOrderRow(poId: string): Promise<boolean> {
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

  const [allItems, purchaseOrders, members] = await Promise.all([
    getItemsByStore(params.id!),
    getPurchaseOrders(params.id!),
    accessLevel === "owner"
      ? getMembersByStore(params.id!)
      : Promise.resolve([]),
  ]);

  const items =
    accessLevel === "public" || accessLevel === "viewer"
      ? allItems.filter((i) => i.isPublic)
      : allItems;

  return { accessLevel, store, items, members, userId, purchaseOrders };
};

// ── Action ─────────────────────────────────────────────────
export const action = async (args: ActionFunctionArgs) => {
  const { request, params } = args;
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const data = await request.json();

  if (data._action === "createItem") {
    const newItem = await createItem({
      name: data.name,
      storeId: params.id!,
      quantity: data.quantity,
      description: data.description,
      blockId: data.blockId ?? undefined,
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

  if (data._action === "updateItem") {
    await updateItem(data.id, {
      name: data.name,
      quantity: data.quantity,
      description: data.description,
      storeId: data.storeId,
      blockId: data.blockId,
      sku: data.sku ?? null,
      unit: data.unit ?? null,
      minQuantity: data.minQuantity ?? null,
      cost: data.cost ?? null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      useRate: data.useRate ?? null,
      useRatePeriod: data.useRatePeriod ?? null,
    });
    return { ok: true };
  }

  if (data._action === "deleteItem") {
    await deleteItem(data.id);
    return { ok: true };
  }

  if (data._action === "removeMember") {
    await removeMember(params.id!, data.userId);
    return { ok: true };
  }

  if (data._action === "createInvite") {
    const token = await createInvite(params.id!, "editor", userId);
    return { ok: true, token };
  }

  if (data._action === "updateVisibility") {
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
  const ok = await commitPurchaseOrderRow(data.id);
  return { ok, optimisticId: data.optimisticId };
}

if (data._action === "buyPOItems") {
  const ids: string[] = Array.isArray(data.ids) ? data.ids : [];
  let committed = 0;
  for (const id of ids) {
    if (await commitPurchaseOrderRow(id)) committed++;
  }
  return { ok: true, committed };
}

  return { ok: false };
};