import {
  eq,
  sql,
  inArray,
  and,
  isNull,
  isNotNull,
  gt,
  gte,
  desc,
  ne,
} from "drizzle-orm";
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
  tradeOffers,
  tradeMessages,
  customFixtures,
  recipes,
  scheduledMeals,
  doseSchedules,
  nameTypeConsensus,
} from "./schema";
import type {
  RecipeIngredient,
  RecipeStep,
  ScheduledMeal,
  MealType,
} from "~/types/recipeTypes";
import type { Recipe } from "./recipes";
import type { CustomFixture, CustomShape } from "~/types/customFixtureTypes";
import type { FixtureCategory } from "~/types/fixtureTypes";
import type { Collection, CollectionKind } from "~/types/collectionTypes";
import type {
  TradeListing,
  TradeOffer,
  TradeOfferStatus,
  TradeMessage,
} from "~/types/tradeTypes";
import type { StoreWithDetails } from "~/types/dashboardTypes";
import type { TemplateWithBlocks } from "~/types/templateTypes";
import type {
  CreateStoreInput,
  BlockDetails,
} from "~/types/storeViewFinderTypes";
import type { AccessLevel, StoreRole } from "~/types/memberTypes";
import type { BlockKind } from "~/types/BlockTypes";
import type { Wall } from "~/types/wallTypes";
import { parseWalls, serializeWalls } from "~/utils/helpers/wall.helper";
import type { ItemType } from "~/types/itemTypeTypes";
import { computeConsensus } from "~/utils/helpers/poInference.helper";

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
    walls: parseWalls(store.walls),
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
    walls: parseWalls(store.walls),
    itemCount: itemCountMap[store.id] ?? 0,
    role: roleMap[store.id] as "editor" | "viewer",
  }));
}

/** Fetch all stores belonging to a user (lightweight, no blocks) */
export async function getStoresByUser(userId: string) {
  return db.select().from(stores).where(eq(stores.userId, userId));
}

/**
 * The user's own name→type "memory": for every item name they've assigned a
 * concrete (non-"other") type to — across all the stores they own, in both
 * inventory and shopping-list rows — the type they've used most. Feeds shopping
 * -list inference so a name typed/confirmed once is remembered everywhere after.
 * Keyed by lower-cased, trimmed name.
 */
export async function getUserTypeHints(
  userId: string,
): Promise<Record<string, ItemType>> {
  const owned = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.userId, userId));
  const storeIds = owned.map((s) => s.id);
  if (!storeIds.length) return {};

  const [itemRows, poRows] = await Promise.all([
    db
      .select({ name: items.name, itemType: items.itemType })
      .from(items)
      .where(
        and(inArray(items.storeId, storeIds), ne(items.itemType, "other")),
      ),
    db
      .select({
        name: purchaseOrderItems.name,
        itemType: purchaseOrderItems.itemType,
      })
      .from(purchaseOrderItems)
      .where(
        and(
          inArray(purchaseOrderItems.storeId, storeIds),
          ne(purchaseOrderItems.itemType, "other"),
        ),
      ),
  ]);

  // Most-used type per name wins (a simple vote across both sources).
  const votes = new Map<string, Map<ItemType, number>>();
  for (const r of [...itemRows, ...poRows]) {
    const key = r.name.trim().toLowerCase();
    if (!key) continue;
    const tally = votes.get(key) ?? new Map<ItemType, number>();
    tally.set(r.itemType, (tally.get(r.itemType) ?? 0) + 1);
    votes.set(key, tally);
  }
  const hints: Record<string, ItemType> = {};
  for (const [key, tally] of votes) {
    let best: [ItemType, number] | null = null;
    for (const entry of tally) if (!best || entry[1] > best[1]) best = entry;
    if (best) hints[key] = best[0];
  }
  return hints;
}

// ─── Crowd type consensus (Stage B: materialised) ──────────
// The k-anonymous name→type map aggregated across ALL users. Scanning every
// item/PO row is expensive, so it's materialised into `name_type_consensus` and
// only rebuilt when the stored copy goes stale — a durable, cross-restart /
// cross-instance cache. Reads take a plain table scan; a short in-process TTL
// keeps the 15s shopping-list poll from even touching the table each time.
const CONSENSUS_SENTINEL = "__lastrun__"; // reserved key canonicalNameKey can't emit
const CROWD_CACHE_TTL_MS = 30 * 60 * 1000; // in-process read cache: 30 min
const CROWD_REFRESH_MS = 6 * 60 * 60 * 1000; // rebuild the table at most every 6 h
let crowdCache: { at: number; map: Record<string, ItemType> } | null = null;

/**
 * Rebuild `name_type_consensus` from every user's items + PO rows and return the
 * fresh name→type map. Only k-anonymous aggregates are stored (see
 * `computeConsensus`): a name surfaces only once enough distinct users agree on a
 * concrete type, so no individual's item names or contents leak. The table is
 * replaced atomically, and a `__lastrun__` sentinel records the rebuild time so an
 * empty result reads as "computed, nothing qualified" rather than "never ran".
 */
export async function recomputeTypeConsensus(): Promise<
  Record<string, ItemType>
> {
  const [itemVotes, poVotes] = await Promise.all([
    db
      .select({
        name: items.name,
        itemType: items.itemType,
        userId: stores.userId,
      })
      .from(items)
      .innerJoin(stores, eq(items.storeId, stores.id))
      .where(ne(items.itemType, "other")),
    db
      .select({
        name: purchaseOrderItems.name,
        itemType: purchaseOrderItems.itemType,
        userId: stores.userId,
      })
      .from(purchaseOrderItems)
      .innerJoin(stores, eq(purchaseOrderItems.storeId, stores.id))
      .where(ne(purchaseOrderItems.itemType, "other")),
  ]);

  const consensus = computeConsensus([...itemVotes, ...poVotes]);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.delete(nameTypeConsensus);
    // Sentinel first so the table is never "empty" after a real run.
    await tx.insert(nameTypeConsensus).values({
      name: CONSENSUS_SENTINEL,
      itemType: "other",
      userCount: 0,
      updatedAt: now,
    });
    // Insert in chunks to stay well under libSQL's bound-parameter limit.
    for (let i = 0; i < consensus.length; i += 100) {
      await tx.insert(nameTypeConsensus).values(
        consensus.slice(i, i + 100).map((c) => ({
          name: c.name,
          itemType: c.itemType,
          userCount: c.userCount,
          updatedAt: now,
        })),
      );
    }
  });

  const map: Record<string, ItemType> = {};
  for (const c of consensus) map[c.name] = c.itemType;
  crowdCache = { at: Date.now(), map };
  return map;
}

/**
 * The crowd name→type map for shopping-list inference (below the user's own
 * memory and the curated lexicon). Reads the materialised table; if it's missing
 * a sentinel or the last rebuild is older than `CROWD_REFRESH_MS`, it triggers a
 * rebuild first. Short-TTL cached in-process. Any DB trouble degrades to an empty
 * map rather than breaking the store load.
 */
export async function getCrowdTypeHints(): Promise<Record<string, ItemType>> {
  const now = Date.now();
  if (crowdCache && now - crowdCache.at < CROWD_CACHE_TTL_MS)
    return crowdCache.map;
  try {
    const rows = await db
      .select({
        name: nameTypeConsensus.name,
        itemType: nameTypeConsensus.itemType,
        updatedAt: nameTypeConsensus.updatedAt,
      })
      .from(nameTypeConsensus);

    const sentinel = rows.find((r) => r.name === CONSENSUS_SENTINEL);
    const lastRun = sentinel?.updatedAt?.getTime() ?? 0;
    if (!sentinel || now - lastRun > CROWD_REFRESH_MS) {
      return await recomputeTypeConsensus();
    }

    const map: Record<string, ItemType> = {};
    for (const r of rows) {
      if (r.name === CONSENSUS_SENTINEL) continue;
      map[r.name] = r.itemType;
    }
    crowdCache = { at: now, map };
    return map;
  } catch {
    // Never let the crowd layer take down the store loader — fall back to none.
    return crowdCache?.map ?? {};
  }
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
      walls: parseWalls(store.walls),
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
      walls: serializeWalls(data.walls ?? []),
    });

    // Auto-insert owner into storeMembers
    await tx
      .insert(storeMembers)
      .values({ storeId: id, userId: data.userId, role: "owner" });

    if (data.blocks?.length) {
      await tx.insert(blocks).values(
        data.blocks.map((b) => ({
          // Preserve the client-supplied id so items added to a just-created
          // block (referenced by the nav-state block id) resolve without a race.
          block_id: b.block_id,
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
    walls?: Wall[];
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
        walls: serializeWalls(data.walls ?? []),
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
    cost?: number | null;
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
    cost: r.cost ?? null,
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
  costCents?: number | null,
) {
  return db
    .insert(itemLogs)
    .values({ itemId, storeId, delta, loggedBy, note, costCents });
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
      note: itemLogs.note,
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
      note: itemLogs.note,
    })
    .from(itemLogs)
    .where(and(...conds))
    .orderBy(sql`${itemLogs.loggedAt} asc`);
}

// ─── SPEND ─────────────────────────────────────────────────
// Spend is reconstructed from restock item-logs that carry a `costCents`
// snapshot. Raw rows are returned for JS-side bucketing (see money.helper), and
// a compact per-type roll-up is aggregated in SQL.

/** Restock spend rows across stores in a window: `{ costCents, loggedAt }`. */
export async function getSpendLogsByStores(storeIds: string[], since?: Date) {
  if (!storeIds.length) return [];
  const conds = [
    inArray(itemLogs.storeId, storeIds),
    isNotNull(itemLogs.costCents),
  ];
  if (since) conds.push(gt(itemLogs.loggedAt, since));
  return db
    .select({ costCents: itemLogs.costCents, loggedAt: itemLogs.loggedAt })
    .from(itemLogs)
    .where(and(...conds))
    .orderBy(sql`${itemLogs.loggedAt} asc`);
}

/** Total spend across stores in a window (cents). */
export async function getSpendTotalByStores(
  storeIds: string[],
  since?: Date,
): Promise<number> {
  if (!storeIds.length) return 0;
  const conds = [
    inArray(itemLogs.storeId, storeIds),
    isNotNull(itemLogs.costCents),
  ];
  if (since) conds.push(gt(itemLogs.loggedAt, since));
  const [row] = await db
    .select({ cents: sql<number>`coalesce(sum(${itemLogs.costCents}), 0)` })
    .from(itemLogs)
    .where(and(...conds));
  return row?.cents ?? 0;
}

/** Spend grouped by item type across stores in a window: `{ itemType, cents }`. */
export async function getSpendByType(storeIds: string[], since?: Date) {
  if (!storeIds.length) return [];
  const conds = [
    inArray(itemLogs.storeId, storeIds),
    isNotNull(itemLogs.costCents),
  ];
  if (since) conds.push(gt(itemLogs.loggedAt, since));
  return db
    .select({
      itemType: items.itemType,
      cents: sql<number>`coalesce(sum(${itemLogs.costCents}), 0)`,
    })
    .from(itemLogs)
    .innerJoin(items, eq(itemLogs.itemId, items.id))
    .where(and(...conds))
    .groupBy(items.itemType);
}

/** An item's restock price points over time (for a price-history sparkline). */
export async function getItemPriceHistory(itemId: string) {
  return db
    .select({
      costCents: itemLogs.costCents,
      delta: itemLogs.delta,
      loggedAt: itemLogs.loggedAt,
    })
    .from(itemLogs)
    .where(and(eq(itemLogs.itemId, itemId), isNotNull(itemLogs.costCents)))
    .orderBy(sql`${itemLogs.loggedAt} asc`);
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
  itemType?: ItemType;
  packageSize?: string | null;
  createdBy?: string | null;
}) {
  const [row] = await db.insert(purchaseOrderItems).values(data).returning();
  return row;
}

export async function updatePurchaseOrder(
  id: string,
  data: Partial<
    Omit<typeof purchaseOrderItems.$inferInsert, "id" | "storeId" | "createdAt">
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
    .where(sql`${templates.isPublic} = 1 OR ${templates.userId} = ${userId}`);
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

  return rows.map((t) => ({
    ...t,
    walls: parseWalls(t.walls),
    blocks: byTemplate[t.id] ?? [],
  }));
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
  return {
    ...tpl,
    walls: parseWalls(tpl.walls),
    blocks: blockRows.map(toTemplateBlockDetails),
  };
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
  walls?: Wall[];
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
      walls: serializeWalls(data.walls ?? []),
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
    walls: store.walls,
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
      walls: tpl.walls ?? "[]", // copy the template's wall layer verbatim (serialized)
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

/**
 * First-run onboarding: create a store from a template, apply the user's zone
 * renames, and place their tapped starter items — all in one transaction. Unlike
 * `createStoreFromTemplate` this assigns explicit block ids so items can be
 * placed into the freshly-created zones by the template block they chose.
 */
export async function onboardStoreFromTemplate(
  userId: string,
  input: {
    templateId: string;
    storeName?: string;
    zones: { templateBlockId: string; label: string }[];
    items: {
      name: string;
      quantity: number;
      itemType?: ItemType;
      templateBlockId: string | null;
    }[];
  },
): Promise<string> {
  return db.transaction(async (tx) => {
    const [tpl] = await tx
      .select()
      .from(templates)
      .where(eq(templates.id, input.templateId));
    if (!tpl) throw new Response("Template not found", { status: 404 });
    if (!tpl.isPublic && tpl.userId !== userId)
      throw new Response("Unauthorized", { status: 403 });

    const storeId = crypto.randomUUID();
    await tx.insert(stores).values({
      id: storeId,
      name: input.storeName?.trim() || tpl.name,
      userId,
      tags: tpl.tags,
      description: tpl.description,
      rows: tpl.rows,
      cols: tpl.cols,
      walls: tpl.walls ?? "[]",
    });
    await tx.insert(storeMembers).values({ storeId, userId, role: "owner" });

    const tBlocks = await tx
      .select()
      .from(templateBlocks)
      .where(eq(templateBlocks.templateId, input.templateId));

    const labelOverride = new Map(
      input.zones.map((z) => [z.templateBlockId, z.label]),
    );
    const idMap = new Map<string, string>(); // template block id → new block id

    if (tBlocks.length) {
      await tx.insert(blocks).values(
        tBlocks.map((b) => {
          const newId = crypto.randomUUID();
          idMap.set(b.block_id, newId);
          return {
            id: newId,
            storeId,
            background: b.background,
            border: b.border,
            label: labelOverride.get(b.block_id)?.trim() || b.label,
            height: b.height,
            width: b.width,
            x: b.x,
            y: b.y,
            kind: b.kind ?? "standard",
            fixture: b.fixture ?? null,
          };
        }),
      );
    }

    const itemValues = input.items
      .filter((it) => it.name.trim())
      .map((it) => ({
        id: crypto.randomUUID(),
        name: it.name.trim(),
        storeId,
        quantity: it.quantity > 0 ? it.quantity : 1,
        blockId: it.templateBlockId
          ? (idMap.get(it.templateBlockId) ?? null)
          : null,
        itemType: it.itemType ?? ("other" as ItemType),
      }));
    if (itemValues.length) await tx.insert(items).values(itemValues);

    await tx
      .update(templates)
      .set({ usageCount: tpl.usageCount + 1 })
      .where(eq(templates.id, input.templateId));

    return storeId;
  });
}

/** Toggle a template between public and private */
export async function updateTemplateVisibility(id: string, isPublic: boolean) {
  return db.update(templates).set({ isPublic }).where(eq(templates.id, id));
}

/** Delete a template (cascades to its blocks) */
export async function deleteTemplate(id: string) {
  return db.delete(templates).where(eq(templates.id, id));
}

// ── Collections / packing ──────────────────────────────────

/** Fetch a store's collections, each with its items (newest collection first). */
export async function getCollections(storeId: string): Promise<Collection[]> {
  let cols;
  try {
    cols = await db
      .select()
      .from(collections)
      .where(eq(collections.storeId, storeId))
      .orderBy(collections.createdAt);
  } catch {
    // is_preset column may not exist pre-migration — degrade to no collections
    // rather than breaking the store load.
    return [];
  }
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
      isPreset: c.isPreset ?? false,
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
  isPreset?: boolean;
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
      isPreset: data.isPreset ?? false,
      userId: data.userId,
    })
    .returning();
  return row;
}

/**
 * Clone a collection (and its item rows) into a new one in the same store.
 * "Save as preset" → `asPreset: true` (a reusable template that never checks
 * out); "Start from preset" → `asPreset: false` (a fresh active set). Copies keep
 * the item links but reset the packed ticks; the new collection starts checked-in.
 */
export async function duplicateCollection(
  sourceId: string,
  userId: string,
  opts: { asPreset: boolean; name?: string },
): Promise<Collection | null> {
  const [src] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, sourceId));
  if (!src) return null;

  const srcItems = await db
    .select()
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, sourceId))
    .orderBy(collectionItems.createdAt);

  const newId = crypto.randomUUID();
  const suffix = opts.asPreset ? " (preset)" : "";
  await db.insert(collections).values({
    id: newId,
    storeId: src.storeId,
    name: opts.name?.trim() || `${src.name}${suffix}`,
    kind: src.kind,
    description: src.description,
    isPreset: opts.asPreset,
    checkedOut: false,
    userId,
  });

  if (srcItems.length) {
    await db.insert(collectionItems).values(
      srcItems.map((r) => ({
        id: crypto.randomUUID(),
        collectionId: newId,
        itemId: r.itemId,
        name: r.name,
        desiredQty: r.desiredQty,
        checked: false,
      })),
    );
  }

  const [created] = await getCollectionsByIds([newId]);
  return created ?? null;
}

/** Fetch specific collections (with items) by id — used after a duplicate. */
async function getCollectionsByIds(ids: string[]): Promise<Collection[]> {
  if (!ids.length) return [];
  const cols = await db
    .select()
    .from(collections)
    .where(inArray(collections.id, ids));
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
  return cols.map((c) => ({
    id: c.id,
    storeId: c.storeId,
    name: c.name,
    description: c.description,
    kind: c.kind as CollectionKind,
    checkedOut: c.checkedOut,
    isPreset: c.isPreset ?? false,
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
  }));
}

/**
 * Recreate a just-deleted collection (and its item rows) from a client snapshot
 * — powers the delete → Undo toast. Honors the client-supplied ids so the
 * optimistic UI reconciles without a refetch. The caller (store.loader) has
 * already authorised the store.
 */
export async function recreateCollectionWithItems(data: {
  id: string;
  storeId: string;
  name: string;
  kind: CollectionKind;
  description?: string | null;
  isPreset?: boolean;
  userId: string;
  items: {
    id: string;
    itemId: string | null;
    name: string;
    desiredQty: number;
    checked: boolean;
  }[];
}) {
  await db.insert(collections).values({
    id: data.id,
    storeId: data.storeId,
    name: data.name,
    kind: data.kind,
    description: data.description ?? null,
    isPreset: data.isPreset ?? false,
    checkedOut: false,
    userId: data.userId,
  });
  if (data.items.length) {
    await db.insert(collectionItems).values(
      data.items.map((r) => ({
        id: r.id,
        collectionId: data.id,
        itemId: r.itemId,
        name: r.name,
        desiredQty: r.desiredQty,
        checked: r.checked,
      })),
    );
  }
  return { id: data.id };
}

export async function updateCollection(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    kind: CollectionKind;
  }>,
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

/** Resolve a block's store — used to scope cross-store mutation guards. */
export async function getBlockStoreId(blockId: string): Promise<string | null> {
  const [row] = await db
    .select({ storeId: blocks.storeId })
    .from(blocks)
    .where(eq(blocks.block_id, blockId));
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
  const itemIds = linked.map((r) => r.itemId).filter((x): x is string => !!x);

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

// ── Trade / Bazaar ─────────────────────────────────────────

/** Every item currently listed for trade, with its store context. */
export async function getTradeListings(): Promise<TradeListing[]> {
  const rows = await db
    .select({
      itemId: items.id,
      name: items.name,
      quantity: items.quantity,
      unit: items.unit,
      itemType: items.itemType,
      sku: items.sku,
      tradeNote: items.tradeNote,
      storeId: stores.id,
      storeName: stores.name,
      storeIsPublic: stores.isPublic,
      ownerUserId: stores.userId,
    })
    .from(items)
    .innerJoin(stores, eq(items.storeId, stores.id))
    .where(eq(items.forTrade, true));
  return rows as TradeListing[];
}

/** Store + owner of an item, for authorizing trade listing. */
export async function getItemOwnerContext(
  itemId: string,
): Promise<{ storeId: string; ownerUserId: string } | null> {
  const [row] = await db
    .select({ storeId: items.storeId, ownerUserId: stores.userId })
    .from(items)
    .innerJoin(stores, eq(items.storeId, stores.id))
    .where(eq(items.id, itemId));
  return row ?? null;
}

export async function setItemForTrade(
  itemId: string,
  forTrade: boolean,
  tradeNote?: string | null,
) {
  await db
    .update(items)
    .set({
      forTrade,
      ...(tradeNote !== undefined ? { tradeNote } : {}),
      // Unlisting clears the wants note.
      ...(!forTrade ? { tradeNote: null } : {}),
    })
    .where(eq(items.id, itemId));
}

export async function createTradeOffer(data: {
  listingItemId: string;
  listingStoreId: string | null;
  listingName: string;
  offeredItemId?: string | null;
  offeredName?: string | null;
  fromUserId: string;
  toUserId: string;
  message?: string | null;
}) {
  const [row] = await db
    .insert(tradeOffers)
    .values({
      listingItemId: data.listingItemId,
      listingStoreId: data.listingStoreId,
      listingName: data.listingName,
      offeredItemId: data.offeredItemId ?? null,
      offeredName: data.offeredName ?? null,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      message: data.message ?? null,
    })
    .returning();
  return row;
}

/** Offers where the user is either the requester or the listing owner. */
export async function getTradeOffersForUser(
  userId: string,
): Promise<TradeOffer[]> {
  try {
    const rows = await db
      .select()
      .from(tradeOffers)
      .where(
        sql`${tradeOffers.fromUserId} = ${userId} OR ${tradeOffers.toUserId} = ${userId}`,
      )
      .orderBy(desc(tradeOffers.createdAt));
    return rows as TradeOffer[];
  } catch {
    // completed_at column may not exist pre-migration — degrade to no offers
    // rather than breaking the whole /trade + dashboard load.
    return [];
  }
}

/** Count of pending offers awaiting the user's response (incoming only). */
export async function getIncomingOfferCount(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(tradeOffers)
      .where(
        and(
          eq(tradeOffers.toUserId, userId),
          eq(tradeOffers.status, "pending"),
        ),
      );
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

export async function getTradeOfferById(id: string) {
  const [row] = await db
    .select()
    .from(tradeOffers)
    .where(eq(tradeOffers.id, id));
  return row ?? null;
}

export async function setTradeOfferStatus(
  id: string,
  status: TradeOfferStatus,
) {
  await db.update(tradeOffers).set({ status }).where(eq(tradeOffers.id, id));
}

/**
 * Accept an offer: mark it accepted, take the listing off the Bazaar, and
 * auto-decline the other pending offers competing for the same item (first
 * accepted wins). Returns the offer (or null if missing).
 */
export async function acceptTradeOffer(id: string) {
  const offer = await getTradeOfferById(id);
  if (!offer) return null;
  await setTradeOfferStatus(id, "accepted");
  if (offer.listingItemId) {
    await db
      .update(items)
      .set({ forTrade: false, tradeNote: null })
      .where(eq(items.id, offer.listingItemId));
    await db
      .update(tradeOffers)
      .set({ status: "declined" })
      .where(
        and(
          eq(tradeOffers.listingItemId, offer.listingItemId),
          eq(tradeOffers.status, "pending"),
          ne(tradeOffers.id, id),
        ),
      );
  }
  return offer;
}

/**
 * Mark an accepted offer as physically completed. Either participant can do it;
 * the caller is responsible for authorising that they're a party. No-op (returns
 * null) unless the offer is currently `accepted`.
 */
export async function completeTradeOffer(id: string) {
  const offer = await getTradeOfferById(id);
  if (!offer || offer.status !== "accepted") return null;
  await db
    .update(tradeOffers)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(tradeOffers.id, id));
  return offer;
}

/** All messages in an offer's thread, oldest first. Resilient to a missing table. */
export async function getTradeMessages(
  offerId: string,
): Promise<TradeMessage[]> {
  try {
    const rows = await db
      .select()
      .from(tradeMessages)
      .where(eq(tradeMessages.offerId, offerId))
      .orderBy(tradeMessages.createdAt);
    return rows as TradeMessage[];
  } catch {
    return [];
  }
}

/** Post a message to an offer's thread. Authorisation is the caller's job. */
export async function createTradeMessage(data: {
  offerId: string;
  fromUserId: string;
  body: string;
}) {
  const [row] = await db.insert(tradeMessages).values(data).returning();
  return row as TradeMessage;
}

// ─── CUSTOM FIXTURES ───────────────────────────────────────

function parseCustomFixture(
  row: typeof customFixtures.$inferSelect,
): CustomFixture {
  let shapes: CustomShape[] = [];
  try {
    const parsed = JSON.parse(row.shapes);
    if (Array.isArray(parsed)) shapes = parsed as CustomShape[];
  } catch {
    shapes = [];
  }
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    category: row.category,
    defaultColor: row.defaultColor,
    shapes,
    createdAt: row.createdAt ? row.createdAt.getTime() : null,
  };
}

/** All custom fixtures owned by a user (newest first). */
export async function getCustomFixturesByUser(
  userId: string,
): Promise<CustomFixture[]> {
  const rows = await db
    .select()
    .from(customFixtures)
    .where(eq(customFixtures.userId, userId))
    .orderBy(desc(customFixtures.createdAt));
  return rows.map(parseCustomFixture);
}

/** Resolve a set of custom-fixture ids (e.g. those placed on a store's blocks),
 *  regardless of owner — so a shared/public store still renders them. */
export async function getCustomFixturesByIds(
  ids: string[],
): Promise<CustomFixture[]> {
  const unique = [...new Set(ids.filter((id) => id.startsWith("cf_")))];
  if (unique.length === 0) return [];
  const rows = await db
    .select()
    .from(customFixtures)
    .where(inArray(customFixtures.id, unique));
  return rows.map(parseCustomFixture);
}

export async function createCustomFixture(input: {
  userId: string;
  name: string;
  category: FixtureCategory;
  defaultColor: string;
  shapes: CustomShape[];
}): Promise<CustomFixture> {
  const [row] = await db
    .insert(customFixtures)
    .values({
      userId: input.userId,
      name: input.name,
      category: input.category,
      defaultColor: input.defaultColor,
      shapes: JSON.stringify(input.shapes ?? []),
    })
    .returning();
  return parseCustomFixture(row);
}

export async function updateCustomFixture(
  id: string,
  userId: string,
  patch: {
    name?: string;
    category?: FixtureCategory;
    defaultColor?: string;
    shapes?: CustomShape[];
  },
): Promise<CustomFixture | null> {
  const set: Partial<typeof customFixtures.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.category !== undefined) set.category = patch.category;
  if (patch.defaultColor !== undefined) set.defaultColor = patch.defaultColor;
  if (patch.shapes !== undefined) set.shapes = JSON.stringify(patch.shapes);
  if (Object.keys(set).length === 0) return null;
  const [row] = await db
    .update(customFixtures)
    .set(set)
    .where(and(eq(customFixtures.id, id), eq(customFixtures.userId, userId)))
    .returning();
  return row ? parseCustomFixture(row) : null;
}

export async function deleteCustomFixture(
  id: string,
  userId: string,
): Promise<void> {
  await db
    .delete(customFixtures)
    .where(and(eq(customFixtures.id, id), eq(customFixtures.userId, userId)));
}

// ─── RECIPES ───────────────────────────────────────────────
// A user's saved recipe library. Ingredients/steps/tags are JSON columns; we
// parse them into the runtime `Recipe` shape with `custom: true` so they drop
// straight into the matcher + panel. All mutations are user-scoped.

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseUserRecipe(row: typeof recipes.$inferSelect): Recipe {
  return {
    id: row.id,
    name: row.name,
    blurb: row.blurb ?? "",
    imageUrl: row.imageUrl ?? undefined,
    sourceUrl: row.sourceUrl ?? undefined,
    ingredients: parseJsonArray<RecipeIngredient>(row.ingredients),
    steps: parseJsonArray<RecipeStep>(row.steps),
    tags: parseJsonArray<string>(row.tags),
    minutes: row.minutes ?? 0,
    serves: row.serves ?? 1,
    custom: true,
    isPublic: row.isPublic,
    usageCount: row.usageCount,
    authorId: row.userId,
  };
}

type RecipeInput = {
  name: string;
  blurb?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags: string[];
  minutes?: number | null;
  serves?: number | null;
};

/** All recipes saved by a user (newest first), as runtime `Recipe`s. Degrades to
 *  [] on DB trouble (e.g. before the recipe-sharing migration adds its columns) so
 *  the store/dashboard loaders never break. */
export async function getUserRecipes(userId: string): Promise<Recipe[]> {
  try {
    const rows = await db
      .select()
      .from(recipes)
      .where(eq(recipes.userId, userId))
      .orderBy(desc(recipes.createdAt));
    return rows.map(parseUserRecipe);
  } catch {
    return [];
  }
}

export async function createUserRecipe(
  input: RecipeInput & { userId: string },
): Promise<Recipe> {
  const [row] = await db
    .insert(recipes)
    .values({
      userId: input.userId,
      name: input.name,
      blurb: input.blurb ?? null,
      imageUrl: input.imageUrl ?? null,
      sourceUrl: input.sourceUrl ?? null,
      ingredients: JSON.stringify(input.ingredients ?? []),
      steps: JSON.stringify(input.steps ?? []),
      tags: JSON.stringify(input.tags ?? []),
      minutes: input.minutes ?? null,
      serves: input.serves ?? null,
    })
    .returning();
  return parseUserRecipe(row);
}

export async function updateUserRecipe(
  id: string,
  userId: string,
  patch: Partial<RecipeInput>,
): Promise<Recipe | null> {
  const set: Partial<typeof recipes.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.blurb !== undefined) set.blurb = patch.blurb;
  if (patch.imageUrl !== undefined) set.imageUrl = patch.imageUrl;
  if (patch.sourceUrl !== undefined) set.sourceUrl = patch.sourceUrl;
  if (patch.ingredients !== undefined)
    set.ingredients = JSON.stringify(patch.ingredients);
  if (patch.steps !== undefined) set.steps = JSON.stringify(patch.steps);
  if (patch.tags !== undefined) set.tags = JSON.stringify(patch.tags);
  if (patch.minutes !== undefined) set.minutes = patch.minutes;
  if (patch.serves !== undefined) set.serves = patch.serves;
  if (Object.keys(set).length === 0) return null;
  const [row] = await db
    .update(recipes)
    .set(set)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .returning();
  return row ? parseUserRecipe(row) : null;
}

export async function deleteUserRecipe(
  id: string,
  userId: string,
): Promise<void> {
  await db
    .delete(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)));
}

// ─── RECIPE SHARING (community / "template recipes") ───────

/**
 * Public recipes for the community tab, most-copied first. Optional case-insensitive
 * name search. Degrades to [] on DB trouble (e.g. before the sharing migration).
 */
export async function getPublicRecipes(
  search?: string,
  limit = 60,
): Promise<Recipe[]> {
  try {
    const conds = [eq(recipes.isPublic, true)];
    const q = (search ?? "").trim().toLowerCase();
    if (q) conds.push(sql`lower(${recipes.name}) like ${"%" + q + "%"}`);
    const rows = await db
      .select()
      .from(recipes)
      .where(and(...conds))
      .orderBy(desc(recipes.usageCount), desc(recipes.createdAt))
      .limit(limit);
    return rows.map(parseUserRecipe);
  } catch {
    return [];
  }
}

/** Toggle a recipe's public visibility (owner-guarded). */
export async function setRecipeVisibility(
  id: string,
  userId: string,
  isPublic: boolean,
): Promise<void> {
  await db
    .update(recipes)
    .set({ isPublic })
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)));
}

/**
 * Copy a public recipe into a user's own library as a fresh `ur_*` clone (keeps
 * sourceUrl, resets sharing), and bump the origin's usageCount. Won't copy your
 * own recipe. Returns the new recipe, or null if the source isn't copyable.
 */
export async function copyRecipeToUser(
  sourceId: string,
  userId: string,
): Promise<Recipe | null> {
  const [src] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, sourceId))
    .limit(1);
  if (!src || !src.isPublic || src.userId === userId) return null;

  const [row] = await db
    .insert(recipes)
    .values({
      userId,
      name: src.name,
      blurb: src.blurb,
      imageUrl: src.imageUrl,
      sourceUrl: src.sourceUrl,
      ingredients: src.ingredients,
      steps: src.steps,
      tags: src.tags,
      minutes: src.minutes,
      serves: src.serves,
      isPublic: false,
      usageCount: 0,
    })
    .returning();
  await db
    .update(recipes)
    .set({ usageCount: (src.usageCount ?? 0) + 1 })
    .where(eq(recipes.id, sourceId));
  return parseUserRecipe(row);
}

// ─── MEAL PLAN ─────────────────────────────────────────────
// Recipes scheduled on a day, per store (owner/editor planning data). All
// mutations are scoped to the store; the loader/action authorises store access.

function parseScheduledMeal(
  row: typeof scheduledMeals.$inferSelect,
): ScheduledMeal {
  return {
    id: row.id,
    storeId: row.storeId,
    recipeRef: row.recipeRef,
    recipeName: row.recipeName,
    dateKey: row.dateKey,
    mealType: row.mealType,
    createdAt: row.createdAt ? row.createdAt.getTime() : null,
  };
}

/** All meals scheduled in a store, ordered by day. */
export async function getScheduledMeals(
  storeId: string,
): Promise<ScheduledMeal[]> {
  const rows = await db
    .select()
    .from(scheduledMeals)
    .where(eq(scheduledMeals.storeId, storeId))
    .orderBy(scheduledMeals.dateKey);
  return rows.map(parseScheduledMeal);
}

export async function createScheduledMeal(input: {
  id?: string;
  storeId: string;
  userId: string;
  recipeRef: string;
  recipeName: string;
  dateKey: string;
  mealType: MealType;
}): Promise<ScheduledMeal> {
  const [row] = await db
    .insert(scheduledMeals)
    .values({
      ...(input.id ? { id: input.id } : {}),
      storeId: input.storeId,
      userId: input.userId,
      recipeRef: input.recipeRef,
      recipeName: input.recipeName,
      dateKey: input.dateKey,
      mealType: input.mealType,
    })
    .returning();
  return parseScheduledMeal(row);
}

/** Delete a scheduled meal, scoped to its store (cross-store guard). */
export async function deleteScheduledMeal(
  id: string,
  storeId: string,
): Promise<void> {
  await db
    .delete(scheduledMeals)
    .where(and(eq(scheduledMeals.id, id), eq(scheduledMeals.storeId, storeId)));
}

// ─── DOSE SCHEDULES (reminders v1) ─────────────────────────
// Opt-in "take N times a day" schedules for medication items. Scoped to the
// user who tracks it. Taking a dose is an itemLogs row (delta −1, note "dose"),
// so adherence + refill prediction reuse existing machinery.

/** A dose schedule joined with its item + store context (pre-adherence). */
export type DoseScheduleRow = {
  id: string;
  itemId: string;
  userId: string;
  timesPerDay: number;
  startDate: Date;
  endDate: Date | null;
  active: boolean;
  createdAt: Date | null;
  itemName: string;
  quantity: number;
  unit: string | null;
  storeId: string;
  storeName: string;
};

/**
 * Every dose schedule a user owns, joined to item + store labels. Degrades to an
 * empty list on any DB trouble (e.g. before the reminders migration is applied)
 * so the dashboard/reminders never break — same resilience as `getCrowdTypeHints`.
 */
export async function getDoseSchedulesByUser(
  userId: string,
): Promise<DoseScheduleRow[]> {
  try {
    return await db
      .select({
        id: doseSchedules.id,
        itemId: doseSchedules.itemId,
        userId: doseSchedules.userId,
        timesPerDay: doseSchedules.timesPerDay,
        startDate: doseSchedules.startDate,
        endDate: doseSchedules.endDate,
        active: doseSchedules.active,
        createdAt: doseSchedules.createdAt,
        itemName: items.name,
        quantity: items.quantity,
        unit: items.unit,
        storeId: items.storeId,
        storeName: stores.name,
      })
      .from(doseSchedules)
      .innerJoin(items, eq(doseSchedules.itemId, items.id))
      .innerJoin(stores, eq(items.storeId, stores.id))
      .where(eq(doseSchedules.userId, userId));
  } catch {
    return [];
  }
}

/** The (single) schedule tracked for an item by a user, or null. */
export async function getDoseScheduleForItem(itemId: string, userId: string) {
  const [row] = await db
    .select()
    .from(doseSchedules)
    .where(
      and(eq(doseSchedules.itemId, itemId), eq(doseSchedules.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}

export async function getDoseScheduleById(id: string) {
  const [row] = await db
    .select()
    .from(doseSchedules)
    .where(eq(doseSchedules.id, id))
    .limit(1);
  return row ?? null;
}

export async function createDoseSchedule(input: {
  itemId: string;
  userId: string;
  timesPerDay: number;
  startDate: Date;
  endDate: Date | null;
}) {
  const [row] = await db
    .insert(doseSchedules)
    .values({
      itemId: input.itemId,
      userId: input.userId,
      timesPerDay: input.timesPerDay,
      startDate: input.startDate,
      endDate: input.endDate,
      active: true,
    })
    .returning();
  return row;
}

/** Update a schedule's cadence/duration/active flag, scoped to its owner. */
export async function updateDoseSchedule(
  id: string,
  userId: string,
  patch: Partial<{
    timesPerDay: number;
    endDate: Date | null;
    active: boolean;
  }>,
) {
  await db
    .update(doseSchedules)
    .set(patch)
    .where(and(eq(doseSchedules.id, id), eq(doseSchedules.userId, userId)));
}

export async function deleteDoseSchedule(
  id: string,
  userId: string,
): Promise<void> {
  await db
    .delete(doseSchedules)
    .where(and(eq(doseSchedules.id, id), eq(doseSchedules.userId, userId)));
}

/**
 * Doses taken today per item — a count of itemLogs with note "dose" on or after
 * `since` (the caller passes local start-of-day). Only the listed items.
 */
export async function getTodayDoseCounts(
  itemIds: string[],
  since: Date,
): Promise<Map<string, number>> {
  if (!itemIds.length) return new Map();
  const rows = await db
    .select({ itemId: itemLogs.itemId, n: sql<number>`count(*)` })
    .from(itemLogs)
    .where(
      and(
        inArray(itemLogs.itemId, itemIds),
        eq(itemLogs.note, "dose"),
        gte(itemLogs.loggedAt, since),
      ),
    )
    .groupBy(itemLogs.itemId);
  return new Map(rows.map((r) => [r.itemId, Number(r.n)]));
}

/** Snooze/dismiss an item's alerts until `until` (null clears the snooze). */
export async function snoozeItemAlert(
  itemId: string,
  until: Date | null,
): Promise<void> {
  await db
    .update(items)
    .set({ alertSnoozedUntil: until })
    .where(eq(items.id, itemId));
}
