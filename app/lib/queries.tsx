import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { stores, items, blocks } from "./schema";
import type { StoreWithDetails } from "~/types/dashboardTypes";
import type {
  CreateStoreInput,
  BlockDetails,
} from "~/types/storeViewFinderTypes";

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

  // Fetch all blocks for all stores in one query
  const allBlocks = await db
    .select()
    .from(blocks)
    .where(sql`${blocks.storeId} IN ${storeIds}`);

  // Fetch item counts per store in one query
  const itemCounts = await db
    .select({
      storeId: items.storeId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(items)
    .where(sql`${items.storeId} IN ${storeIds}`)
    .groupBy(items.storeId);

  const itemCountMap = Object.fromEntries(
    itemCounts.map((r) => [r.storeId, r.count]),
  );

  const blocksByStore = allBlocks.reduce<Record<string, BlockDetails[]>>(
    (acc, block) => {
      if (!acc[block.storeId]) acc[block.storeId] = [];
      acc[block.storeId].push({
        block_id: block.block_id,
        background: block.background,
        border: block.border,
        label: block.label,
        height: block.height,
        width: block.width,
        x: block.x,
        y: block.y,
      });
      return acc;
    },
    {},
  );

  return userStores.map((store) => ({
    ...store,
    blocks: blocksByStore[store.id] ?? [],
    itemCount: itemCountMap[store.id] ?? 0,
  }));
}

/** Fetch all stores belonging to a user (lightweight, no blocks) */
export async function getStoresByUser(userId: string) {
  return db.select().from(stores).where(eq(stores.userId, userId));
}

/** Fetch a single store by ID, including its blocks */
export async function getStoreById(id: string) {
  return db.transaction(async (tx) => {
    const storeResult = await tx.select().from(stores).where(eq(stores.id, id));
    const store = storeResult[0];
    if (!store) return null;

    const blocksResult = await tx
      .select()
      .from(blocks)
      .where(eq(blocks.storeId, id));

    const blkDetails: BlockDetails[] = blocksResult.map((block) => ({
      block_id: block.block_id,
      background: block.background,
      border: block.border,
      label: block.label,
      height: block.height,
      width: block.width,
      x: block.x,
      y: block.y,
    }));

    const res: CreateStoreInput = {
      id: store.id,
      name: store.name,
      userId: store.userId,
      tags: store.tags,
      description: store.description ?? undefined,
      rows: store.rows,
      cols: store.cols,
      blocks: blkDetails.length ? blkDetails : [],
    };
    return res;
  });
}

/** Create a new store */
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

export async function createStoreWithBlocks(data: CreateStoreInput) {
  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();

    await tx.insert(stores).values({
      id,
      name: data.name,
      userId: data.userId,
      tags: data.tags ?? "[]",
      description: data.description ?? null,
      rows: data.rows ?? 10,
      cols: data.cols ?? 10,
    });

    if (data.blocks?.length) {
      await tx.insert(blocks).values(
        data.blocks.map((block) => ({
          storeId: id,
          background: block.background ?? "#000000",
          border: block.border ?? "#000000",
          label: block.label ?? "",
          height: block.height ?? 1,
          width: block.width ?? 1,
          x: block.x ?? 0,
          y: block.y ?? 0,
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
        })),
      );
    }

    return newId;
  });
}

/** Update a store's details */
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

// ─── BLOCKS ────────────────────────────────────────────────

/** Fetch all blocks in a store */
export async function getBlocksByStore(storeId: string) {
  return db.select().from(blocks).where(eq(blocks.storeId, storeId));
}

/** Create a new block */
export async function createBlock(data: {
  storeId: string;
  background?: string;
  border?: string;
  label?: string;
  height?: number;
  width?: number;
  x?: number;
  y?: number;
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
  }>,
) {
  return db.update(blocks).set(data).where(eq(blocks.block_id, blockId));
}

/** Delete a block */
export async function deleteBlock(blockId: string) {
  return db.delete(blocks).where(eq(blocks.block_id, blockId));
}

// ─── ITEMS ─────────────────────────────────────────────────

/** Fetch all items in a store */
export async function getItemsByStore(storeId: string) {
  return db.select().from(items).where(eq(items.storeId, storeId));
}

/** Fetch a single item by ID */
export async function getItemById(id: string) {
  const result = await db.select().from(items).where(eq(items.id, id));
  return result[0] ?? null;
}

/** Create a new item */
export async function createItem(data: {
  name: string;
  storeId: string;
  quantity?: number;
  description?: string;
  blockId?: string;
}) {
  return db.insert(items).values({
    name: data.name,
    storeId: data.storeId,
    quantity: data.quantity ?? 0,
    description: data.description ?? null,
    blockId: data.blockId,
  });
}

/** Update an item */
export async function updateItem(
  id: string,
  data: Partial<{
    name: string;
    storeId: string;
    quantity: number;
    description: string;
    blockId: string;
  }>,
) {
  return db.update(items).set(data).where(eq(items.id, id));
}

/** Delete an item */
export async function deleteItem(id: string) {
  return db.delete(items).where(eq(items.id, id));
}

/** Count items per store */
export async function getItemCountByStore(storeId: string) {
  const result = await getItemsByStore(storeId);
  return result.length;
}
