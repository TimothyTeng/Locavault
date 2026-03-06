import { eq } from "drizzle-orm";
import { db } from "./db";
import { stores, items } from "./schema";

// ─── STORES ────────────────────────────────────────────────

/** Fetch all stores belonging to a user */
export async function getStoresByUser(userId: string) {
  return db.select().from(stores).where(eq(stores.userId, userId));
}

/** Fetch a single store by ID */
export async function getStoreById(id: string) {
  const result = await db.select().from(stores).where(eq(stores.id, id));
  return result[0] ?? null;
}

/** Create a new store */
export async function createStore(data: {
  name: string;
  userId: string;
  width?: number;
  height?: number;
  grid?: string;
}) {
  return db.insert(stores).values({
    name: data.name,
    userId: data.userId,
    width: data.width ?? 10,
    height: data.height ?? 10,
    grid: data.grid ?? "[]",
  });
}

/** Update a store's details */
export async function updateStore(
  id: string,
  data: Partial<{ name: string; width: number; height: number; grid: string }>,
) {
  return db.update(stores).set(data).where(eq(stores.id, id));
}

/** Delete a store (cascades to items via FK) */
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
  xCord?: number;
  yCord?: number;
}) {
  return db.insert(items).values({
    name: data.name,
    storeId: data.storeId,
    quantity: data.quantity ?? 0,
    description: data.description ?? null,
    xCord: data.xCord ?? 0,
    yCord: data.yCord ?? 0,
  });
}

/** Update an item */
export async function updateItem(
  id: string,
  data: Partial<{
    name: string;
    quantity: number;
    description: string;
    xCord: number;
    yCord: number;
  }>,
) {
  return db.update(items).set(data).where(eq(items.id, id));
}

/** Delete an item */
export async function deleteItem(id: string) {
  return db.delete(items).where(eq(items.id, id));
}

/** Count items per store — useful for card display */
export async function getItemCountByStore(storeId: string) {
  const result = await getItemsByStore(storeId);
  return result.length;
}
