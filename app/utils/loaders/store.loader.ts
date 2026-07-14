import { getAuth } from "~/lib/auth";
import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
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
  updateMemberRole,
  updateItem,
  updateItemVisibility,
  updatePurchaseOrder,
  updateStoreVisibility,
  verifyStoreAccess,
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  addCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
  setCollectionCheckedOut,
  getCollectionStoreId,
  getBlockStoreId,
  getCustomFixturesByIds,
  getUserRecipes,
  getScheduledMeals,
  createScheduledMeal,
  deleteScheduledMeal,
  getUserTypeHints,
  getCrowdTypeHints,
} from "~/lib/queries";
import {
  estimateUsage,
  needsRunoutConfirm,
  suggestRestockQty,
} from "~/utils/helpers/usage.helper";
import { decrementForIngredient } from "~/utils/helpers/recipeCook.helper";
import { resolveUserProfiles } from "~/lib/clerkUsers";
import {
  requireText,
  optText,
  optInt,
  toQty,
  optDate,
} from "~/utils/helpers/validate.helper";
import { toActionResult } from "~/utils/loaders/actionResult";
import type { UsageLog } from "~/types/storeTypes";
import type { ItemType } from "~/types/itemTypeTypes";
import { MEAL_TYPES, type MealType } from "~/types/recipeTypes";

/** Window of consumption history (days) pulled to estimate usage. */
const USAGE_WINDOW_DAYS = 120;

/** One row of a bulk quick-add payload (untrusted client JSON). */
type QuickAddRow = {
  name?: unknown;
  blockId?: string | null;
  quantity?: unknown;
  itemType?: ItemType;
  unit?: unknown;
  optimisticId?: string;
};

/**
 * Commit a single purchase-order row to inventory:
 * - linked item → add its quantity to the existing item
 * - unlinked    → create a fresh item
 * Then delete the PO row. Returns false if the row/linked item is missing.
 */
async function commitPurchaseOrderRow(
  poId: string,
  expectedStoreId: string,
  loggedBy?: string,
): Promise<boolean> {
  const poRow = await getPurchaseOrderById(poId);
  if (!poRow) return false;
  // Cross-store guard: the PO row must belong to the acting store.
  if (poRow.storeId !== expectedStoreId) return false;

  if (poRow.itemId) {
    const existing = await getItemById(poRow.itemId);
    if (!existing) return false;
    await updateItem(poRow.itemId, {
      name: poRow.name,
      quantity: existing.quantity + poRow.quantity,
      storeId: poRow.storeId,
      blockId: poRow.blockId ?? undefined,
      description: poRow.description ?? undefined,
      // Only upgrade an existing item's type if the PO carried a concrete guess —
      // never overwrite a real type back to "other".
      ...(poRow.itemType && poRow.itemType !== "other"
        ? { itemType: poRow.itemType }
        : {}),
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
      itemType: poRow.itemType ?? undefined,
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

  // Shopping lists and collections are owner/editor planning data — never expose
  // them to viewers or public visitors (they'd otherwise leak in the loader JSON
  // even if the UI hides them).
  const canEdit = accessLevel === "owner" || accessLevel === "editor";

  const usageSince = new Date(Date.now() - USAGE_WINDOW_DAYS * 86_400_000);
  const [
    allItems,
    purchaseOrders,
    members,
    usageLogs,
    collections,
    scheduledMeals,
    typeHints,
    crowdHints,
  ] = await Promise.all([
    getItemsByStore(params.id!),
    canEdit ? getPurchaseOrders(params.id!) : Promise.resolve([]),
    accessLevel === "owner"
      ? getMembersByStore(params.id!)
      : Promise.resolve([]),
    getUsageLogsByStore(params.id!, usageSince),
    canEdit ? getCollections(params.id!) : Promise.resolve([]),
    canEdit ? getScheduledMeals(params.id!) : Promise.resolve([]),
    canEdit && userId
      ? getUserTypeHints(userId)
      : Promise.resolve({} as Record<string, ItemType>),
    canEdit
      ? getCrowdTypeHints()
      : Promise.resolve({} as Record<string, ItemType>),
  ]);

  // Resolve member userIds → names/avatars (owner-only panel; degrades to raw ids).
  const memberProfiles = members.length
    ? await resolveUserProfiles(
        args,
        members.map((m) => m.userId),
      )
    : {};
  const membersWithNames = members.map((m) => ({
    ...m,
    displayName: memberProfiles[m.userId]?.displayName,
    imageUrl: memberProfiles[m.userId]?.imageUrl ?? null,
  }));

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
  const items = visibleItems.map((item) => {
    const logs = logsByItem.get(item.id) ?? [];
    const usage = estimateUsage(item, logs, now);
    return {
      ...item,
      usage,
      runoutConfirm: needsRunoutConfirm(item, usage, logs, now),
    };
  });

  // Resolve any custom fixtures placed on this store's blocks (by id, so a
  // shared/public store still renders the owner's custom fixtures).
  const customFixtures = await getCustomFixturesByIds(
    store.blocks.map((b) => b.fixture).filter((f): f is string => !!f),
  );

  // The signed-in user's saved recipe library — matched against this store's
  // pantry in the Recipes panel (user-scoped, like customFixtures).
  const userRecipes = userId ? await getUserRecipes(userId) : [];

  return {
    accessLevel,
    store,
    items,
    members: membersWithNames,
    userId,
    purchaseOrders,
    collections,
    customFixtures,
    userRecipes,
    scheduledMeals,
    typeHints,
    crowdHints,
  };
};

// ── Action ─────────────────────────────────────────────────
const runStoreAction = async (args: ActionFunctionArgs) => {
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

  // ── Cross-store guards ──
  // Authorization above only proves the caller can edit THIS store. Object ids
  // come from the client, so each referenced item/block must be confirmed to
  // live in this store before we touch it — otherwise an editor of store A could
  // mutate store B's data by passing its ids (IDOR).
  const ensureItemInStore = async (itemId: string) => {
    const item = await getItemById(itemId);
    if (!item || item.storeId !== params.id)
      throw new Response("Forbidden", { status: 403 });
    return item;
  };
  const ensureBlockInStore = async (blockId?: string | null) => {
    if (!blockId) return;
    const sid = await getBlockStoreId(blockId);
    if (sid !== params.id) throw new Response("Forbidden", { status: 403 });
  };
  const ensurePOInStore = async (poId: string) => {
    const po = await getPurchaseOrderById(poId);
    if (!po || po.storeId !== params.id)
      throw new Response("Forbidden", { status: 403 });
    return po;
  };

  if (data._action === "createItem") {
    await ensureBlockInStore(data.blockId);
    const newItem = await createItem({
      name: requireText(data.name, "Item name"),
      storeId: params.id!,
      quantity: toQty(data.quantity, 1),
      description: optText(data.description) ?? undefined,
      blockId: data.blockId ?? undefined,
      itemType: data.itemType ?? undefined,
      sku: optText(data.sku) ?? undefined,
      unit: optText(data.unit) ?? undefined,
      minQuantity: optInt(data.minQuantity) ?? undefined,
      cost: optInt(data.cost) ?? undefined,
      expiryDate: optDate(data.expiryDate) ?? undefined,
      useRate: optInt(data.useRate) ?? undefined,
      useRatePeriod: data.useRatePeriod ?? undefined,
    });
    return { ok: true, id: newItem.id, optimisticId: data.optimisticId };
  }

  if (data._action === "createItems") {
    const rows = (
      (Array.isArray(data.items) ? data.items : []) as QuickAddRow[]
    ).filter((r) => typeof r.name === "string" && r.name.trim());
    for (const r of rows) await ensureBlockInStore(r.blockId);
    const ids = await createItems(
      rows.map((r) => ({
        name: requireText(r.name, "Item name"),
        storeId: params.id!,
        quantity: toQty(r.quantity, 1),
        blockId: r.blockId ?? undefined,
        itemType: r.itemType ?? undefined,
        unit: optText(r.unit) ?? undefined,
      })),
    );
    return {
      ok: true,
      created: rows.map((r, i) => ({
        optimisticId: r.optimisticId,
        id: ids[i],
      })),
    };
  }

  if (data._action === "updateItem") {
    // Capture the quantity change as a usage log so predictions can learn.
    const prev = await ensureItemInStore(data.id);
    await ensureBlockInStore(data.blockId);
    const newQty = toQty(data.quantity, prev.quantity);
    await updateItem(data.id, {
      name: requireText(data.name, "Item name"),
      quantity: newQty,
      description: optText(data.description) ?? undefined,
      storeId: params.id!, // never let the client move an item across stores
      blockId: data.blockId,
      ...(data.itemType ? { itemType: data.itemType } : {}),
      sku: optText(data.sku),
      unit: optText(data.unit),
      minQuantity: optInt(data.minQuantity),
      cost: optInt(data.cost),
      expiryDate: optDate(data.expiryDate),
      useRate: optInt(data.useRate),
      useRatePeriod: data.useRatePeriod ?? null,
    });
    const delta = newQty - prev.quantity;
    if (delta !== 0) {
      await createItemLog(data.id, params.id!, delta, userId, "edit");
    }
    return { ok: true };
  }

  if (data._action === "deleteItem") {
    await ensureItemInStore(data.id);
    await deleteItem(data.id);
    return { ok: true };
  }

  // One-tap "we're out": the sanctioned outflow signal. Zero the quantity, log
  // the depletion (a strong calibration point for usage prediction), and queue a
  // restock on the shopping list if one isn't already there.
  if (data._action === "markItemOut") {
    const item = await ensureItemInStore(data.id);
    if (item.quantity > 0) {
      await createItemLog(item.id, item.storeId, -item.quantity, userId, "out");
      await updateItem(item.id, { quantity: 0 });
    }
    const existing = await getPurchaseOrders(params.id!);
    if (!existing.some((p) => p.itemId === item.id)) {
      // Estimate a sensible restock from history for the auto-queued row.
      const logs = await getUsageLogsByStore(item.storeId);
      const usage = estimateUsage(item, logs);
      const fallback = suggestRestockQty(item, usage);
      await createPurchaseOrder({
        itemId: item.id,
        storeId: item.storeId,
        name: item.name,
        quantity: toQty(data.restockQty, fallback, { min: 1 }),
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

  // Confirm-loop answer "still have it": the predicted run-out passed but stock
  // remains. Log a zero-delta "confirmed" censor point — the estimator reads it
  // as survival-past-prediction and lengthens the next estimate — and silence the
  // question for this cycle. No quantity change.
  if (data._action === "stillHave") {
    const item = await ensureItemInStore(data.id);
    await createItemLog(item.id, item.storeId, 0, userId, "confirmed");
    return { ok: true };
  }

  // "Cooked this": subtract the ingredients a recipe used from stock and log the
  // consumption (feeds run-out prediction). Measurement-aware via the shared
  // helper; rows carry the recipe ingredient's amount/unit, the item supplies
  // its own unit. Lenient — unmatched/incompatible units get a coarse nudge.
  if (data._action === "cookedRecipe") {
    const servings = toQty(data.servings, 1, { min: 1, max: 100 });
    const rows = Array.isArray(data.items) ? data.items : [];
    let decremented = 0;
    for (const r of rows) {
      if (!r || typeof r.itemId !== "string") continue;
      const item = await ensureItemInStore(r.itemId);
      if (item.quantity <= 0) continue;
      const dec = decrementForIngredient(
        {
          amount: typeof r.amount === "number" ? r.amount : undefined,
          unit: typeof r.unit === "string" ? r.unit : undefined,
        },
        item.unit,
        servings,
      );
      if (dec <= 0) continue;
      const newQty = Math.max(0, item.quantity - dec);
      if (newQty === item.quantity) continue;
      await updateItem(item.id, { quantity: newQty });
      await createItemLog(
        item.id,
        item.storeId,
        newQty - item.quantity,
        userId,
        "cooked",
      );
      decremented++;
    }
    return { ok: true, decremented };
  }

  // ── Meal plan ──
  if (data._action === "scheduleMeal") {
    const dateKey = String(data.dateKey ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey))
      throw new Response("Bad date", { status: 400 });
    const mealType: MealType = MEAL_TYPES.includes(data.mealType)
      ? data.mealType
      : "dinner";
    const row = await createScheduledMeal({
      id: data.id ?? undefined,
      storeId: params.id!,
      userId,
      recipeRef: String(data.recipeRef ?? "").slice(0, 200) || "custom",
      recipeName: requireText(data.recipeName, "Recipe name").slice(0, 200),
      dateKey,
      mealType,
    });
    return { ok: true, id: row.id, optimisticId: data.optimisticId };
  }

  if (data._action === "unscheduleMeal") {
    await deleteScheduledMeal(String(data.id ?? ""), params.id!);
    return { ok: true };
  }

  if (data._action === "removeMember") {
    if (!isOwner) throw new Response("Forbidden", { status: 403 });
    await removeMember(params.id!, data.userId);
    return { ok: true };
  }

  if (data._action === "updateMemberRole") {
    if (!isOwner) throw new Response("Forbidden", { status: 403 });
    // Owners can toggle a member between editor/viewer, but never touch the
    // owner role or demote themselves out of ownership.
    const role = data.role === "viewer" ? "viewer" : "editor";
    if (data.userId === userId)
      throw new Response("Forbidden", { status: 403 });
    await updateMemberRole(params.id!, String(data.userId), role);
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
    await ensureItemInStore(data.itemId);
    await updateItemVisibility(data.itemId, data.isPublic);
    return { ok: true };
  }

  if (data._action === "createPOItem") {
    if (data.itemId) await ensureItemInStore(data.itemId);
    await ensureBlockInStore(data.blockId);
    const row = await createPurchaseOrder({
      itemId: data.itemId ?? null,
      storeId: params.id!,
      name: requireText(data.name, "Item name"),
      quantity: toQty(data.quantity, 1, { min: 1 }),
      blockId: data.blockId ?? null,
      description: optText(data.description),
      sku: optText(data.sku),
      unit: optText(data.unit),
      minQuantity: optInt(data.minQuantity),
      cost: optInt(data.cost),
      expiryDate: optDate(data.expiryDate),
      useRate: optInt(data.useRate),
      useRatePeriod: data.useRatePeriod ?? null,
      itemType: data.itemType ?? undefined,
      packageSize: optText(data.packageSize),
      createdBy: userId ?? null,
    });
    return { ok: true, id: row.id, optimisticId: data.optimisticId };
  }

  if (data._action === "createPOItems") {
    const rows = Array.isArray(data.items) ? data.items : [];
    for (const r of rows) {
      if (r.itemId) await ensureItemInStore(r.itemId);
      await ensureBlockInStore(r.blockId);
      if (!(typeof r?.name === "string" && r.name.trim())) continue;
      await createPurchaseOrder({
        itemId: r.itemId ?? null,
        storeId: params.id!,
        name: requireText(r.name, "Item name"),
        quantity: toQty(r.quantity, 1, { min: 1 }),
        blockId: r.blockId ?? null,
        description: optText(r.description),
        sku: optText(r.sku),
        unit: optText(r.unit),
        minQuantity: optInt(r.minQuantity),
        cost: optInt(r.cost),
        expiryDate: optDate(r.expiryDate),
        useRate: optInt(r.useRate),
        useRatePeriod: r.useRatePeriod ?? null,
        itemType: r.itemType ?? undefined,
        packageSize: optText(r.packageSize),
        createdBy: userId ?? null,
      });
    }
    return { ok: true };
  }

  if (data._action === "updatePOItem") {
    await ensurePOInStore(data.id);
    await ensureBlockInStore(data.blockId);
    if (data.itemId) await ensureItemInStore(data.itemId);
    await updatePurchaseOrder(data.id, {
      name: requireText(data.name, "Item name"),
      quantity: toQty(data.quantity, 1, { min: 1 }),
      // Only (re)link when the client sends an itemId — a plain name/qty edit
      // omits it, preserving any existing link.
      ...(data.itemId !== undefined ? { itemId: data.itemId } : {}),
      blockId: data.blockId ?? null,
      description: optText(data.description),
      sku: optText(data.sku),
      unit: optText(data.unit),
      minQuantity: optInt(data.minQuantity),
      cost: optInt(data.cost),
      expiryDate: optDate(data.expiryDate),
      useRate: optInt(data.useRate),
      useRatePeriod: data.useRatePeriod ?? null,
      ...(data.itemType ? { itemType: data.itemType } : {}),
      packageSize: optText(data.packageSize),
    });
    return { ok: true };
  }

  // Bulk metadata backfill: fill type/location/unit (and link) on existing rows
  // without touching name/quantity. Used to auto-fill older rows that predate
  // inference, in one request instead of N.
  if (data._action === "updatePOItems") {
    const rows = Array.isArray(data.items) ? data.items : [];
    for (const r of rows) {
      if (!r?.id) continue;
      await ensurePOInStore(r.id);
      await ensureBlockInStore(r.blockId);
      if (r.itemId) await ensureItemInStore(r.itemId);
      await updatePurchaseOrder(r.id, {
        ...(r.itemId !== undefined ? { itemId: r.itemId } : {}),
        blockId: r.blockId ?? null,
        unit: optText(r.unit),
        minQuantity: optInt(r.minQuantity),
        cost: optInt(r.cost),
        useRate: optInt(r.useRate),
        useRatePeriod: r.useRatePeriod ?? null,
        ...(r.itemType ? { itemType: r.itemType } : {}),
      });
    }
    return { ok: true };
  }

  if (data._action === "deletePOItem") {
    await ensurePOInStore(data.id);
    await deletePurchaseOrder(data.id);
    return { ok: true };
  }

  if (data._action === "buyPOItem") {
    const ok = await commitPurchaseOrderRow(data.id, params.id!, userId);
    return { ok, optimisticId: data.optimisticId };
  }

  if (data._action === "buyPOItems") {
    const ids: string[] = Array.isArray(data.ids) ? data.ids : [];
    let committed = 0;
    for (const id of ids) {
      if (await commitPurchaseOrderRow(id, params.id!, userId)) committed++;
    }
    return { ok: true, committed };
  }

  // ── Collections / packing ──
  // Item-level ops carry their collectionId so we can confirm the collection
  // actually belongs to THIS store before mutating (cross-store guard).
  const ensureCollectionInStore = async (collectionId: string) => {
    const sid = await getCollectionStoreId(collectionId);
    if (sid !== params.id) throw new Response("Forbidden", { status: 403 });
  };

  if (data._action === "createCollection") {
    const row = await createCollection({
      id: data.id ?? undefined,
      storeId: params.id!,
      name: optText(data.name) ?? "Untitled",
      kind: data.kind ?? "packing",
      description: optText(data.description),
      userId,
    });
    return { ok: true, id: row.id };
  }

  if (data._action === "updateCollection") {
    await ensureCollectionInStore(data.id);
    await updateCollection(data.id, {
      ...(data.name != null ? { name: data.name } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.kind ? { kind: data.kind } : {}),
    });
    return { ok: true };
  }

  if (data._action === "deleteCollection") {
    await ensureCollectionInStore(data.id);
    await deleteCollection(data.id);
    return { ok: true };
  }

  if (data._action === "addCollectionItem") {
    await ensureCollectionInStore(data.collectionId);
    if (data.itemId) await ensureItemInStore(data.itemId);
    const row = await addCollectionItem({
      id: data.id ?? undefined,
      collectionId: data.collectionId,
      itemId: data.itemId ?? null,
      name: requireText(data.name, "Item name"),
      desiredQty: toQty(data.desiredQty, 1, { min: 1 }),
    });
    return { ok: true, id: row.id };
  }

  if (data._action === "updateCollectionItem") {
    await ensureCollectionInStore(data.collectionId);
    await updateCollectionItem(data.id, {
      ...(data.name != null
        ? { name: requireText(data.name, "Item name") }
        : {}),
      ...(data.desiredQty != null
        ? { desiredQty: toQty(data.desiredQty, 1, { min: 1 }) }
        : {}),
      ...(data.checked != null ? { checked: !!data.checked } : {}),
    });
    return { ok: true };
  }

  if (data._action === "removeCollectionItem") {
    await ensureCollectionInStore(data.collectionId);
    await removeCollectionItem(data.id);
    return { ok: true };
  }

  if (data._action === "setCollectionCheckedOut") {
    await ensureCollectionInStore(data.id);
    await setCollectionCheckedOut(data.id, !!data.checkedOut);
    return { ok: true };
  }

  return { ok: false };
};

// Public action: convert expected 4xx failures into `{ ok: false, error }` so a
// failed background mutation toasts + rolls back instead of blanking the page.
export const action = (args: ActionFunctionArgs) =>
  toActionResult(runStoreAction(args));
