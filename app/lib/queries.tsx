import { eq, sql, inArray, and, isNull, gt } from "drizzle-orm";
import { db } from "./db";
import {
  stores,
  items,
  blocks,
  storeMembers,
  storeInvites,
  itemLogs,
  purchaseOrderItems,
  templates,
  templateBlocks,
  collections,
  collectionItems,
} from "./schema";
import type { Collection, CollectionKind } from "~/types/collectionTypes";
import type { StoreWithDetails } from "~/types/dashboardTypes";
import type { TemplateWithBlocks } from "~/types/templateTypes";
import type {
  CreateStoreInput,
  BlockDetails,
} from "~/types/storeViewFinderTypes";
import type { AccessLevel, StoreRole } from "~/types/memberTypes";
import type { BlockKind } from "~/types/BlockTypes";
import type { ItemType } from "~/types/itemTypeTypes";

// ─── Helpers ───────────────────────────────────────────────

/** Map a raw DB block row to the BlockDetails shape */
function toBlockDetails(b: typeof blocks.$inferSelect): BlockDetails {
  return {
    block_id: b.block_id,
    background: b.background,
    border: b.border,
    label: b.label,
    height: b.height,
    width: b.width,
    x: b.x,
    y: b.y,
    kind: (b.kind ?? "standard") as BlockKind,
    fixture: b.fixture ?? null,
  };
}

/** Group a flat block array into a storeId → BlockDetails[] map */
function groupBlocksByStore(
  rows: (typeof blocks.$inferSelect)[],
): Record<string, BlockDetails[]> {
  return rows.reduce<Record<string, BlockDetails[]>>((acc, b) => {
    (acc[b.storeId] ??= []).push(toBlockDetails(b));
    return acc;
  }, {});
}

// ─── STORES ────────────────────────────────────────────────

/** Fetch all stores for a user with their blocks and item counts */
export async function getStoresByUserWithDetails(
  userId: string,
): Promise<StoreWithDetails[]> {
  const userStores = await db
    .select()
    .from(stores)
    .where(eq(stores.userId, userId));
  if (!userStores.length) return [];

  const storeIds = userStores.map((s) => s.id);

  const [allBlocks, itemCounts] = await Promise.all([
    db.select().from(blocks).where(inArray(blocks.storeId, storeIds)),
    db
      .select({
        storeId: items.storeId,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(items)
      .where(inArray(items.storeId, storeIds))
      .groupBy(items.storeId),
  ]);

  const blocksByStore = groupBlocksByStore(allBlocks);
  const itemCountMap = Object.fromEntries(
    itemCounts.map((r) => [r.storeId, r.count]),
  );

  return userStores.map((store) => ({
    ...store,
    blocks: blocksByStore[store.id] ?? [],
    itemCount: itemCountMap[store.id] ?? 0,
  }));
}

/** Fetch stores the user is a member of (editor/viewer) but does not own */
export async function getStoresMemberOf(
  userId: string,
): Promise<StoreWithDetails[]> {
  const memberships = await db
    .select()
    .from(storeMembers)
    .where(
      sql`${storeMembers.userId} = ${userId} AND ${storeMembers.role} != 'owner'`,
    );

  if (!memberships.length) return [];

  const storeIds = memberships.map((m) => m.storeId);
  const memberStores = await db
    .select()
    .from(stores)
    .where(inArray(stores.id, storeIds));

  // Exclude stores the user also owns (edge case)
  const nonOwnedStores = memberStores.filter((s) => s.userId !== userId);
  if (!nonOwnedStores.length) return [];

  const nonOwnedIds = nonOwnedStores.map((s) => s.id);

  const [allBlocks, itemCounts] = await Promise.all([
    db.select().from(blocks).where(inArray(blocks.storeId, nonOwnedIds)),
    db
      .select({
        storeId: items.storeId,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(items)
      .where(inArray(items.storeId, nonOwnedIds))
      .groupBy(items.storeId),
  ]);

  const blocksByStore = groupBlocksByStore(allBlocks);
  const itemCountMap = Object.fromEntries(
    itemCounts.map((r) => [r.storeId, r.count]),
  );
  const roleMap = Object.fromEntries(
    memberships.map((m) => [m.storeId, m.role]),
  );

  return nonOwnedStores.map((store) => ({
    ...store,
    blocks: blocksByStore[store.id] ?? [],
    itemCount: itemCountMap[store.id] ?? 0,
    role: roleMap[store.id] as "editor" | "viewer",
  }));
}

/** Fetch all stores belonging to a user (lightweight, no blocks) */
export async function getStoresByUser(userId: string) {
  return db.select().from(stores).where(eq(stores.userId, userId));
}

/** Fetch a single store by ID, including its blocks */
export async function getStoreById(
  id: string,
): Promise<CreateStoreInput | null> {
  return db.transaction(async (tx) => {
    const storeResult = await tx.select().from(stores).where(eq(stores.id, id));
    const store = storeResult[0];
    if (!store) return null;

    const blockRows = await tx
      .select()
      .from(blocks)
      .where(eq(blocks.storeId, id));

    return {
      id: store.id,
      name: store.name,
      userId: store.userId,
      tags: store.tags,
      description: store.description ?? undefined,
      rows: store.rows,
      cols: store.cols,
      blocks: blockRows.map(toBlockDetails),
      isPublic: store.isPublic,
      canvasVisible: store.canvasVisible,
    };
  });
}

/** Create a new store (no blocks) */
export async function createStore(data: {
  name: string;
  userId: string;
  tags?: string;
  description?: string;
  rows?: number;
  cols?: number;
}) {
  return db.insert(stores).values({
    name: data.name,
    userId: data.userId,
    tags: data.tags ?? "[]",
    description: data.description ?? null,
    rows: data.rows ?? 10,
    cols: data.cols ?? 10,
  });
}

/** Create a store together with its blocks in a single transaction */
export async function createStoreWithBlocks(data: CreateStoreInput) {
  return db.transaction(async (tx) => {
    const id = data.id ?? crypto.randomUUID();

    await tx.insert(stores).values({
      id,
      name: data.name,
      userId: data.userId,
      tags: data.tags ?? "[]",
      description: data.description ?? null,
      rows: data.rows ?? 10,
      cols: data.cols ?? 10,
    });

    // Auto-insert owner into storeMembers
    await tx
      .insert(storeMembers)
      .values({ storeId: id, userId: data.userId, role: "owner" });

    if (data.blocks?.length) {
      await tx.insert(blocks).values(
        data.blocks.map((b) => ({
          storeId: id,
          background: b.background ?? "#000000",
          border: b.border ?? "#000000",
          label: b.label ?? "",
          height: b.height ?? 1,
          width: b.width ?? 1,
          x: b.x ?? 0,
          y: b.y ?? 0,
          kind: b.kind ?? "standard",
          fixture: b.fixture ?? null,
        })),
      );
    }

    return id;
  });
}

/** Duplicate a store and all its blocks under a new ID */
export async function duplicateStore(
  storeId: string,
  userId: string,
): Promise<string> {
  return db.transaction(async (tx) => {
    const storeResult = await tx
      .select()
      .from(stores)
      .where(eq(stores.id, storeId));
    const store = storeResult[0];
    if (!store) throw new Response("Store not found", { status: 404 });

    const newId = crypto.randomUUID();

    await tx.insert(stores).values({
      id: newId,
      name: `${store.name} (copy)`,
      userId,
      tags: store.tags,
      description: store.description,
      rows: store.rows,
      cols: store.cols,
    });

    await tx
      .insert(storeMembers)
      .values({ storeId: newId, userId, role: "owner" });

    const existingBlocks = await tx
      .select()
      .from(blocks)
      .where(eq(blocks.storeId, storeId));

    if (existingBlocks.length) {
      await tx.insert(blocks).values(
        existingBlocks.map((b) => ({
          storeId: newId,
          background: b.background,
          border: b.border,
          label: b.label,
          height: b.height,
          width: b.width,
          x: b.x,
          y: b.y,
          kind: b.kind ?? "standard",
        })),
      );
    }

    return newId;
  });
}

/** Update a store's metadata */
export async function updateStore(
  id: string,
  data: Partial<{
    name: string;
    tags: string;
    description: string;
    rows: number;
    cols: number;
  }>,
) {
  return db.update(stores).set(data).where(eq(stores.id, id));
}

/** Delete a store (cascades to items and blocks via FK) */
export async function deleteStore(id: string) {
  return db.delete(stores).where(eq(stores.id, id));
}

/** Verify a store belongs to a user before mutating it */
export async function verifyStoreOwner(storeId: string, userId: string) {
  const store = await getStoreById(storeId);
  if (!store) throw new Response("Store not found", { status: 404 });
  if (store.userId !== userId)
    throw new Response("Unauthorized", { status: 403 });
  return store;
}

/**
 * Determine the access level for a user (or null = unauthenticated) on a store.
 * Returns the store + accessLevel together to avoid a double fetch.
 */
export async function verifyStoreAccess(
  storeId: string,
  userId: string | null,
): Promise<{ store: CreateStoreInput; accessLevel: AccessLevel } | null> {
  const store = await getStoreById(storeId);
  if (!store) return null;

  if (userId) {
    if (store.userId === userId) return { store, accessLevel: "owner" };

    const memberResult = await db
      .select()
      .from(storeMembers)
      .where(
        sql`${storeMembers.storeId} = ${storeId} AND ${storeMembers.userId} = ${userId}`,
      );

    const member = memberResult[0];
    if (member) return { store, accessLevel: member.role as AccessLevel };
  }

  if (store.isPublic) return { store, accessLevel: "public" };

  return { store, accessLevel: "none" };
}

/** Update store visibility toggles */
export async function updateStoreVisibility(
  storeId: string,
  data: Partial<{ isPublic: boolean; canvasVisible: boolean }>,
) {
  return db.update(stores).set(data).where(eq(stores.id, storeId));
}

/** Update per-item visibility */
export async function updateItemVisibility(itemId: string, isPublic: boolean) {
  return db.update(items).set({ isPublic }).where(eq(items.id, itemId));
}

// ─── BLOCKS ────────────────────────────────────────────────

/** Fetch all blocks in a store */
export async function getBlocksByStore(storeId: string) {
  return db.select().from(blocks).where(eq(blocks.storeId, storeId));
}

/** Create a single block */
export async function createBlock(data: {
  storeId: string;
  background?: string;
  border?: string;
  label?: string;
  height?: number;
  width?: number;
  x?: number;
  y?: number;
  kind?: BlockKind;
}) {
  return db.insert(blocks).values({
    storeId: data.storeId,
    background: data.background ?? "#000000",
    border: data.border ?? "#000000",
    label: data.label ?? "",
    height: data.height ?? 1,
    width: data.width ?? 1,
    x: data.x ?? 0,
    y: data.y ?? 0,
    kind: data.kind ?? "standard",
  });
}

/** Update a block */
export async function updateBlock(
  blockId: string,
  data: Partial<{
    background: string;
    border: string;
    label: string;
    height: number;
    width: number;
    x: number;
    y: number;
    kind: BlockKind;
  }>,
) {
  return db.update(blocks).set(data).where(eq(blocks.block_id, blockId));
}

/** Delete a block */
export async function deleteBlock(blockId: string) {
  return db.delete(blocks).where(eq(blocks.block_id, blockId));
}

/**
 * Replace all blocks for an existing store atomically.
 * Null-outs blockId on any items that referenced removed blocks.
 */
export async function updateStoreWithBlocks(
  storeId: string,
  data: {
    name: string;
    tags: string;
    description?: string;
    rows: number;
    cols: number;
    blocks: BlockDetails[];
  },
) {
  return db.transaction(async (tx) => {
    await tx
      .update(stores)
      .set({
        name: data.name,
        tags: data.tags,
        description: data.description ?? null,
        rows: data.rows,
        cols: data.cols,
      })
      .where(eq(stores.id, storeId));

    const existing = await tx
      .select({ block_id: blocks.block_id })
      .from(blocks)
      .where(eq(blocks.storeId, storeId));
    const existingIds = existing.map((b) => b.block_id);
    const incomingIds = data.blocks.map((b) => b.block_id);
    const removedIds = existingIds.filter((id) => !incomingIds.includes(id));

    if (removedIds.length) {
      await tx
        .update(items)
        .set({ blockId: null })
        .where(inArray(items.blockId, removedIds));
    }

    await tx.delete(blocks).where(eq(blocks.storeId, storeId));

    if (data.blocks.length) {
      await tx.insert(blocks).values(
        data.blocks.map((b) => ({
          block_id: b.block_id,
          storeId,
          background: b.background,
          border: b.border,
          label: b.label,
          height: b.height,
          width: b.width,
          x: b.x,
          y: b.y,
          kind: b.kind ?? "standard",
          fixture: b.fixture ?? null,
        })),
      );
    }
  });
}

// ─── ITEMS ─────────────────────────────────────────────────

/** Fetch all items in a store */
export async function getItemsByStore(storeId: string) {
  return db.select().from(items).where(eq(items.storeId, storeId));
}

/** Fetch all items across several stores (dashboard foresight digest). */
export async function getItemsByStores(storeIds: string[]) {
  if (!storeIds.length) return [];
  return db.select().from(items).where(inArray(items.storeId, storeIds));
}

/** Fetch a single item by ID */
export async function getItemById(id: string) {
  const result = await db.select().from(items).where(eq(items.id, id));
  return result[0] ?? null;
}

/** Create a new item — returns the inserted row's ID */
export async function createItem(data: {
  name: string;
  storeId: string;
  quantity?: number;
  description?: string;
  blockId?: string;
  itemType?: ItemType;
  sku?: string;
  unit?: string;
  minQuantity?: number;
  cost?: number;
  expiryDate?: Date;
  useRate?: number;
  useRatePeriod?: "day" | "week" | "month";
}) {
  const id = crypto.randomUUID();
  await db.insert(items).values({
    id,
    name: data.name,
    storeId: data.storeId,
    quantity: data.quantity ?? 0,
    description: data.description ?? null,
    blockId: data.blockId,
    itemType: data.itemType ?? "other",
    sku: data.sku ?? null,
    unit: data.unit ?? null,
    minQuantity: data.minQuantity ?? null,
    cost: data.cost ?? null,
    expiryDate: data.expiryDate ?? null,
    useRate: data.useRate ?? null,
    useRatePeriod: data.useRatePeriod ?? null,
  });
  return { id };
}

/** Bulk-create items (quick capture). Returns new ids in input order. */
export async function createItems(
  rows: Array<{
    name: string;
    storeId: string;
    quantity?: number;
    blockId?: string | null;
    itemType?: ItemType;
    unit?: string | null;
  }>,
): Promise<string[]> {
  if (!rows.length) return [];
  const values = rows.map((r) => ({
    id: crypto.randomUUID(),
    name: r.name,
    storeId: r.storeId,
    quantity: r.quantity ?? 0,
    blockId: r.blockId ?? undefined,
    itemType: r.itemType ?? "other",
    unit: r.unit ?? null,
  }));
  await db.insert(items).values(values);
  return values.map((v) => v.id);
}

/** Update an item */
export async function updateItem(
  id: string,
  data: Partial<{
    name: string;
    storeId: string;
    quantity: number;
    description: string;
    blockId: string | null;
    itemType: ItemType;
    sku: string | null;
    unit: string | null;
    minQuantity: number | null;
    cost: number | null;
    expiryDate: Date | null;
    useRate: number | null;
    useRatePeriod: "day" | "week" | "month" | null;
  }>,
) {
  return db.update(items).set(data).where(eq(items.id, id));
}

/** Delete an item */
export async function deleteItem(id: string) {
  return db.delete(items).where(eq(items.id, id));
}

/** Count items in a store */
export async function getItemCountByStore(storeId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(items)
    .where(eq(items.storeId, storeId));
  return result[0]?.count ?? 0;
}

// ─── ITEM LOGS ─────────────────────────────────────────────

/** Log a quantity change — call alongside updateItem whenever quantity changes */
export async function createItemLog(
  itemId: string,
  storeId: string,
  delta: number,
  loggedBy?: string,
  note?: string,
) {
  return db.insert(itemLogs).values({ itemId, storeId, delta, loggedBy, note });
}

/** Fetch all logs for an item, newest first */
export async function getItemLogs(itemId: string) {
  return db
    .select()
    .from(itemLogs)
    .where(eq(itemLogs.itemId, itemId))
    .orderBy(sql`${itemLogs.loggedAt} desc`);
}

/**
 * Fetch usage logs (every quantity change — both consumption and restocks) for
 * an entire store in one query, oldest first. The estimator learns outflow from
 * negative deltas and inflow cadence from the spacing of positive (restock)
 * deltas. Optionally bounded to logs after `since` so we only pull the window.
 */
export async function getUsageLogsByStore(storeId: string, since?: Date) {
  const conds = [eq(itemLogs.storeId, storeId)];
  if (since) conds.push(gt(itemLogs.loggedAt, since));
  return db
    .select({
      itemId: itemLogs.itemId,
      delta: itemLogs.delta,
      loggedAt: itemLogs.loggedAt,
    })
    .from(itemLogs)
    .where(and(...conds))
    .orderBy(sql`${itemLogs.loggedAt} asc`);
}

/** Usage logs across several stores (dashboard foresight digest). */
export async function getUsageLogsByStores(storeIds: string[], since?: Date) {
  if (!storeIds.length) return [];
  const conds = [inArray(itemLogs.storeId, storeIds)];
  if (since) conds.push(gt(itemLogs.loggedAt, since));
  return db
    .select({
      itemId: itemLogs.itemId,
      delta: itemLogs.delta,
      loggedAt: itemLogs.loggedAt,
    })
    .from(itemLogs)
    .where(and(...conds))
    .orderBy(sql`${itemLogs.loggedAt} asc`);
}

/**
 * Predict days until an item runs out.
 * Uses log history if available, falls back to useRate/useRatePeriod fields.
 * Returns null if there's not enough data to make a prediction.
 */
export async function predictRunoutDays(
  itemId: string,
): Promise<number | null> {
  const item = await getItemById(itemId);
  if (!item || item.quantity <= 0) return null;

  // ── Log-based prediction (preferred) ──
  const logs = await db
    .select()
    .from(itemLogs)
    .where(and(eq(itemLogs.itemId, itemId), sql`${itemLogs.delta} < 0`))
    .orderBy(sql`${itemLogs.loggedAt} asc`);

  if (logs.length >= 2) {
    const totalConsumed = logs.reduce((sum, l) => sum + Math.abs(l.delta), 0);
    const first = logs[0].loggedAt!.getTime();
    const last = logs[logs.length - 1].loggedAt!.getTime();
    const days = (last - first) / (1000 * 60 * 60 * 24);
    if (days > 0) {
      const dailyRate = totalConsumed / days;
      return Math.floor(item.quantity / dailyRate);
    }
  }

  // ── Fallback: manual useRate fields ──
  if (item.useRate && item.useRatePeriod) {
    const periodDays = { day: 1, week: 7, month: 30 }[item.useRatePeriod];
    const dailyRate = item.useRate / periodDays;
    return Math.floor(item.quantity / dailyRate);
  }

  return null;
}

// ─── MEMBERS ───────────────────────────────────────────────

/** Fetch all members of a store */
export async function getMembersByStore(storeId: string) {
  return db
    .select()
    .from(storeMembers)
    .where(eq(storeMembers.storeId, storeId));
}

/** Add a member to a store */
export async function addMember(
  storeId: string,
  userId: string,
  role: StoreRole,
) {
  return db.insert(storeMembers).values({ storeId, userId, role });
}

/** Update a member's role */
export async function updateMemberRole(
  storeId: string,
  userId: string,
  role: StoreRole,
) {
  return db
    .update(storeMembers)
    .set({ role })
    .where(
      and(eq(storeMembers.storeId, storeId), eq(storeMembers.userId, userId)),
    );
}

/** Remove a member from a store */
export async function removeMember(storeId: string, userId: string) {
  return db
    .delete(storeMembers)
    .where(
      and(eq(storeMembers.storeId, storeId), eq(storeMembers.userId, userId)),
    );
}

// ─── INVITES ───────────────────────────────────────────────

/**
 * Create an editor invite link (7-day expiry).
 * Reuses an existing valid (unclaimed, unexpired) invite for the same store + role.
 */
export async function createInvite(
  storeId: string,
  role: "editor",
  createdBy: string,
) {
  const now = new Date();

  const existing = await db
    .select()
    .from(storeInvites)
    .where(
      and(
        eq(storeInvites.storeId, storeId),
        eq(storeInvites.role, role),
        isNull(storeInvites.claimedAt),
        gt(storeInvites.expiresAt, now),
      ),
    )
    .limit(1);

  if (existing.length) return existing[0].token;

  const token = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db
    .insert(storeInvites)
    .values({ storeId, token, role, expiresAt, createdBy });
  return token;
}

/** Fetch an invite by token */
export async function getInviteByToken(token: string) {
  const result = await db
    .select()
    .from(storeInvites)
    .where(eq(storeInvites.token, token));
  return result[0] ?? null;
}

/**
 * Claim an invite:
 * - Validates not expired / not already claimed
 * - Checks the user isn't already a member or the owner
 * - Inserts into storeMembers and marks invite as claimed
 * Returns the storeId on success, throws a Response on failure.
 */
export async function claimInvite(token: string, userId: string) {
  return db.transaction(async (tx) => {
    const inviteResult = await tx
      .select()
      .from(storeInvites)
      .where(eq(storeInvites.token, token));
    const invite = inviteResult[0];

    if (!invite) throw new Response("Invite not found", { status: 404 });
    if (invite.claimedAt)
      throw new Response("Invite already claimed", { status: 410 });
    if (new Date() > invite.expiresAt)
      throw new Response("Invite expired", { status: 410 });

    const [existingMember, storeResult] = await Promise.all([
      tx
        .select()
        .from(storeMembers)
        .where(
          and(
            eq(storeMembers.storeId, invite.storeId),
            eq(storeMembers.userId, userId),
          ),
        ),
      tx.select().from(stores).where(eq(stores.id, invite.storeId)),
    ]);

    const isOwner = storeResult[0]?.userId === userId;

    if (!existingMember.length && !isOwner) {
      await tx
        .insert(storeMembers)
        .values({ storeId: invite.storeId, userId, role: invite.role });
    }

    await tx
      .update(storeInvites)
      .set({ claimedAt: new Date() })
      .where(eq(storeInvites.token, token));

    return invite.storeId;
  });
}

// ── Purchase Orders ────────────────────────────────────────

export async function getPurchaseOrders(storeId: string) {
  return db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.storeId, storeId))
    .orderBy(purchaseOrderItems.createdAt);
}

/** Item ids already on a shopping list across several stores (dedupe digest). */
export async function getListedItemIds(storeIds: string[]): Promise<string[]> {
  if (!storeIds.length) return [];
  const rows = await db
    .select({ itemId: purchaseOrderItems.itemId })
    .from(purchaseOrderItems)
    .where(inArray(purchaseOrderItems.storeId, storeIds));
  return rows.map((r) => r.itemId).filter((x): x is string => !!x);
}

export async function createPurchaseOrder(data: {
  itemId?: string | null;
  storeId: string;
  name: string;
  quantity: number;
  blockId?: string | null;
  description?: string | null;
  sku?: string | null;
  unit?: string | null;
  minQuantity?: number | null;
  cost?: number | null;
  expiryDate?: Date | null;
  useRate?: number | null;
  useRatePeriod?: "day" | "week" | "month" | null;
  createdBy?: string | null;
}) {
  const [row] = await db.insert(purchaseOrderItems).values(data).returning();
  return row;
}

export async function updatePurchaseOrder(
  id: string,
  data: Partial<
    Omit<
      typeof purchaseOrderItems.$inferInsert,
      "id" | "storeId" | "createdAt" | "itemId"
    >
  >,
) {
  const [row] = await db
    .update(purchaseOrderItems)
    .set(data)
    .where(eq(purchaseOrderItems.id, id))
    .returning();
  return row;
}

export async function deletePurchaseOrder(id: string) {
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
}

export async function getPurchaseOrderById(id: string) {
  const [row] = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.id, id));

  return row ?? null;
}

// ── Templates ──────────────────────────────────────────────

/** Map a raw template-block row to the shared BlockDetails shape */
function toTemplateBlockDetails(
  b: typeof templateBlocks.$inferSelect,
): BlockDetails {
  return {
    block_id: b.block_id,
    background: b.background,
    border: b.border,
    label: b.label,
    height: b.height,
    width: b.width,
    x: b.x,
    y: b.y,
    kind: (b.kind ?? "standard") as BlockKind,
    fixture: b.fixture ?? null,
  };
}

/** Fetch templates visible to a user: all public ones + their own private ones */
export async function getTemplatesForGallery(
  userId: string,
): Promise<TemplateWithBlocks[]> {
  const rows = await db
    .select()
    .from(templates)
    .where(
      sql`${templates.isPublic} = 1 OR ${templates.userId} = ${userId}`,
    );
  if (!rows.length) return [];

  const ids = rows.map((t) => t.id);
  const blockRows = await db
    .select()
    .from(templateBlocks)
    .where(inArray(templateBlocks.templateId, ids));

  const byTemplate = blockRows.reduce<Record<string, BlockDetails[]>>(
    (acc, b) => {
      (acc[b.templateId] ??= []).push(toTemplateBlockDetails(b));
      return acc;
    },
    {},
  );

  return rows.map((t) => ({ ...t, blocks: byTemplate[t.id] ?? [] }));
}

/** Fetch a single template with its blocks */
export async function getTemplateById(
  id: string,
): Promise<TemplateWithBlocks | null> {
  const [tpl] = await db.select().from(templates).where(eq(templates.id, id));
  if (!tpl) return null;
  const blockRows = await db
    .select()
    .from(templateBlocks)
    .where(eq(templateBlocks.templateId, id));
  return { ...tpl, blocks: blockRows.map(toTemplateBlockDetails) };
}

/** Verify a template belongs to a user before mutating it */
export async function verifyTemplateOwner(id: string, userId: string) {
  const [tpl] = await db.select().from(templates).where(eq(templates.id, id));
  if (!tpl) throw new Response("Template not found", { status: 404 });
  if (tpl.userId !== userId)
    throw new Response("Unauthorized", { status: 403 });
  return tpl;
}

/** Create a template (from-scratch builder or programmatically) */
export async function createTemplate(data: {
  name: string;
  userId: string;
  description?: string | null;
  tags?: string;
  rows?: number;
  cols?: number;
  isPublic?: boolean;
  blocks: BlockDetails[];
}): Promise<string> {
  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(templates).values({
      id,
      name: data.name,
      userId: data.userId,
      description: data.description ?? null,
      tags: data.tags ?? "[]",
      rows: data.rows ?? 10,
      cols: data.cols ?? 10,
      isPublic: data.isPublic ?? false,
    });
    if (data.blocks.length) {
      await tx.insert(templateBlocks).values(
        data.blocks.map((b) => ({
          templateId: id,
          background: b.background,
          border: b.border,
          label: b.label,
          height: b.height,
          width: b.width,
          x: b.x,
          y: b.y,
          kind: b.kind ?? "standard",
          fixture: b.fixture ?? null,
        })),
      );
    }
    return id;
  });
}

/** Snapshot an existing store's layout into a new template */
export async function createTemplateFromStore(
  storeId: string,
  userId: string,
  opts: { name?: string; description?: string | null; isPublic?: boolean },
): Promise<string> {
  const store = await getStoreById(storeId);
  if (!store) throw new Response("Store not found", { status: 404 });
  return createTemplate({
    name: opts.name?.trim() || store.name,
    userId,
    description: opts.description ?? store.description ?? null,
    tags: store.tags ?? "[]",
    rows: store.rows,
    cols: store.cols,
    isPublic: opts.isPublic ?? false,
    blocks: store.blocks,
  });
}

/** Instantiate a new store from a template (the "adder"). Copies blocks with
 *  fresh ids, adds the owner member, and bumps the template's usage count. */
export async function createStoreFromTemplate(
  templateId: string,
  userId: string,
  name?: string,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [tpl] = await tx
      .select()
      .from(templates)
      .where(eq(templates.id, templateId));
    if (!tpl) throw new Response("Template not found", { status: 404 });
    if (!tpl.isPublic && tpl.userId !== userId)
      throw new Response("Unauthorized", { status: 403 });

    const newId = crypto.randomUUID();
    await tx.insert(stores).values({
      id: newId,
      name: name?.trim() || tpl.name,
      userId,
      tags: tpl.tags,
      description: tpl.description,
      rows: tpl.rows,
      cols: tpl.cols,
    });

    await tx
      .insert(storeMembers)
      .values({ storeId: newId, userId, role: "owner" });

    const tBlocks = await tx
      .select()
      .from(templateBlocks)
      .where(eq(templateBlocks.templateId, templateId));

    if (tBlocks.length) {
      await tx.insert(blocks).values(
        tBlocks.map((b) => ({
          storeId: newId,
          background: b.background,
          border: b.border,
          label: b.label,
          height: b.height,
          width: b.width,
          x: b.x,
          y: b.y,
          kind: b.kind ?? "standard",
          fixture: b.fixture ?? null,
        })),
      );
    }

    await tx
      .update(templates)
      .set({ usageCount: tpl.usageCount + 1 })
      .where(eq(templates.id, templateId));

    return newId;
  });
}

/** Toggle a template between public and private */
export async function updateTemplateVisibility(
  id: string,
  isPublic: boolean,
) {
  return db.update(templates).set({ isPublic }).where(eq(templates.id, id));
}

/** Delete a template (cascades to its blocks) */
export async function deleteTemplate(id: string) {
  return db.delete(templates).where(eq(templates.id, id));
}

// ── Collections / packing ──────────────────────────────────

/** Fetch a store's collections, each with its items (newest collection first). */
export async function getCollections(storeId: string): Promise<Collection[]> {
  const cols = await db
    .select()
    .from(collections)
    .where(eq(collections.storeId, storeId))
    .orderBy(collections.createdAt);
  if (!cols.length) return [];

  const ids = cols.map((c) => c.id);
  const ciRows = await db
    .select()
    .from(collectionItems)
    .where(inArray(collectionItems.collectionId, ids))
    .orderBy(collectionItems.createdAt);

  const byCollection = new Map<string, typeof ciRows>();
  for (const r of ciRows) {
    const arr = byCollection.get(r.collectionId);
    if (arr) arr.push(r);
    else byCollection.set(r.collectionId, [r]);
  }

  return cols
    .map((c) => ({
      id: c.id,
      storeId: c.storeId,
      name: c.name,
      description: c.description,
      kind: c.kind as CollectionKind,
      checkedOut: c.checkedOut,
      userId: c.userId,
      createdAt: c.createdAt,
      items: (byCollection.get(c.id) ?? []).map((r) => ({
        id: r.id,
        collectionId: r.collectionId,
        itemId: r.itemId,
        name: r.name,
        desiredQty: r.desiredQty,
        checked: r.checked,
        createdAt: r.createdAt,
      })),
    }))
    .reverse(); // newest first
}

export async function createCollection(data: {
  id?: string;
  storeId: string;
  name: string;
  kind?: CollectionKind;
  description?: string | null;
  userId: string;
}) {
  const [row] = await db
    .insert(collections)
    .values({
      ...(data.id ? { id: data.id } : {}),
      storeId: data.storeId,
      name: data.name,
      kind: data.kind ?? "packing",
      description: data.description ?? null,
      userId: data.userId,
    })
    .returning();
  return row;
}

export async function updateCollection(
  id: string,
  data: Partial<{ name: string; description: string | null; kind: CollectionKind }>,
) {
  const [row] = await db
    .update(collections)
    .set(data)
    .where(eq(collections.id, id))
    .returning();
  return row;
}

export async function deleteCollection(id: string) {
  await db.delete(collections).where(eq(collections.id, id));
}

/** The store a collection belongs to — used to authorize collection mutations. */
export async function getCollectionStoreId(id: string): Promise<string | null> {
  const [row] = await db
    .select({ storeId: collections.storeId })
    .from(collections)
    .where(eq(collections.id, id));
  return row?.storeId ?? null;
}

export async function addCollectionItem(data: {
  id?: string;
  collectionId: string;
  itemId?: string | null;
  name: string;
  desiredQty?: number;
}) {
  const [row] = await db
    .insert(collectionItems)
    .values({
      ...(data.id ? { id: data.id } : {}),
      collectionId: data.collectionId,
      itemId: data.itemId ?? null,
      name: data.name,
      desiredQty: data.desiredQty ?? 1,
    })
    .returning();
  return row;
}

export async function updateCollectionItem(
  id: string,
  data: Partial<{ name: string; desiredQty: number; checked: boolean }>,
) {
  const [row] = await db
    .update(collectionItems)
    .set(data)
    .where(eq(collectionItems.id, id))
    .returning();
  return row;
}

export async function removeCollectionItem(id: string) {
  await db.delete(collectionItems).where(eq(collectionItems.id, id));
}

/**
 * Check a collection out (taken away) or back in. Flags the collection and the
 * transient loan state on every linked item — without touching quantities. On
 * check-out, also tick everything as "packed". See DESIGN.md §7.
 */
export async function setCollectionCheckedOut(
  collectionId: string,
  checkedOut: boolean,
) {
  await db
    .update(collections)
    .set({ checkedOut })
    .where(eq(collections.id, collectionId));

  const linked = await db
    .select({ itemId: collectionItems.itemId })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId));
  const itemIds = linked
    .map((r) => r.itemId)
    .filter((x): x is string => !!x);

  if (itemIds.length) {
    await db
      .update(items)
      .set({ checkedOut })
      .where(inArray(items.id, itemIds));
  }

  if (checkedOut) {
    await db
      .update(collectionItems)
      .set({ checked: true })
      .where(eq(collectionItems.collectionId, collectionId));
  }
}
