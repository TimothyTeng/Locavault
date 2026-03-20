import { eq, sql, inArray, and, isNull, gt } from "drizzle-orm";
import { db } from "./db";
import { stores, items, blocks, storeMembers, storeInvites } from "./schema";
import type { StoreWithDetails } from "~/types/dashboardTypes";
import type {
  CreateStoreInput,
  BlockDetails,
} from "~/types/storeViewFinderTypes";
import type { AccessLevel, StoreRole } from "~/types/memberTypes";

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

  const allBlocks = await db
    .select()
    .from(blocks)
    .where(sql`${blocks.storeId} IN ${storeIds}`);

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

/** Fetch stores the user is a member of (editor/viewer) but does not own */
export async function getStoresMemberOf(
  userId: string,
): Promise<StoreWithDetails[]> {
  // Find memberships where user is not the store owner
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
    .where(sql`${stores.id} IN ${storeIds}`);

  // Exclude stores the user also owns (edge case)
  const nonOwnedStores = memberStores.filter((s) => s.userId !== userId);
  if (!nonOwnedStores.length) return [];

  const nonOwnedIds = nonOwnedStores.map((s) => s.id);

  const allBlocks = await db
    .select()
    .from(blocks)
    .where(sql`${blocks.storeId} IN ${nonOwnedIds}`);

  const itemCounts = await db
    .select({
      storeId: items.storeId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(items)
    .where(sql`${items.storeId} IN ${nonOwnedIds}`)
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
      isPublic: store.isPublic,
      canvasVisible: store.canvasVisible,
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
    await tx.insert(storeMembers).values({
      storeId: id,
      userId: data.userId,
      role: "owner",
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

    await tx.insert(storeMembers).values({
      storeId: newId,
      userId,
      role: "owner",
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

/**
 * Determine access level for a user (or null = unauthenticated) on a store.
 * Returns the store + accessLevel together to avoid double fetches.
 */
export async function verifyStoreAccess(
  storeId: string,
  userId: string | null,
): Promise<{ store: CreateStoreInput; accessLevel: AccessLevel } | null> {
  const store = await getStoreById(storeId);
  if (!store) return null;

  // Authenticated — check membership
  if (userId) {
    // Owner check via userId column (original owner who created the store)
    if (store.userId === userId) {
      return { store, accessLevel: "owner" };
    }

    // Check storeMembers table
    const memberResult = await db
      .select()
      .from(storeMembers)
      .where(
        sql`${storeMembers.storeId} = ${storeId} AND ${storeMembers.userId} = ${userId}`,
      );
    const member = memberResult[0];
    if (member) {
      return { store, accessLevel: member.role as AccessLevel };
    }
  }

  // Not a member — check if store is public
  if (store.isPublic) {
    return { store, accessLevel: "public" };
  }

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

/** Create a new item — returns the inserted row including server-assigned ID */
export async function createItem(data: {
  name: string;
  storeId: string;
  quantity?: number;
  description?: string;
  blockId?: string;
}) {
  const id = crypto.randomUUID();
  await db.insert(items).values({
    id,
    name: data.name,
    storeId: data.storeId,
    quantity: data.quantity ?? 0,
    description: data.description ?? null,
    blockId: data.blockId,
  });
  return { id };
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

/**
 * Replace all blocks for an existing store and null-out blockId
 * on any items that referenced deleted blocks.
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

    if (removedIds.length > 0) {
      await tx
        .update(items)
        .set({ blockId: null })
        .where(inArray(items.blockId, removedIds));
    }

    await tx.delete(blocks).where(eq(blocks.storeId, storeId));

    if (data.blocks.length > 0) {
      await tx.insert(blocks).values(
        data.blocks.map((block) => ({
          block_id: block.block_id,
          storeId,
          background: block.background,
          border: block.border,
          label: block.label,
          height: block.height,
          width: block.width,
          x: block.x,
          y: block.y,
        })),
      );
    }
  });
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
      sql`${storeMembers.storeId} = ${storeId} AND ${storeMembers.userId} = ${userId}`,
    );
}

/** Remove a member from a store */
export async function removeMember(storeId: string, userId: string) {
  return db
    .delete(storeMembers)
    .where(
      sql`${storeMembers.storeId} = ${storeId} AND ${storeMembers.userId} = ${userId}`,
    );
}

// ─── INVITES ───────────────────────────────────────────────

/** Create a new editor invite link (7-day expiry), reusing an existing valid one if present */
export async function createInvite(
  storeId: string,
  role: "editor",
  createdBy: string,
) {
  const now = new Date();

  // Reuse any existing unclaimed, unexpired invite for this store+role
  // Use and() with Drizzle operators so timestamp serialisation is handled correctly
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

  if (existing.length > 0) return existing[0].token;

  // None found — create a fresh one
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
 * - Validates not expired, not already claimed
 * - Checks user isn't already a member
 * - Inserts into storeMembers
 * - Marks invite as claimed
 * Returns the storeId on success, throws on failure.
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

    // Check if already a member
    const existing = await tx
      .select()
      .from(storeMembers)
      .where(
        sql`${storeMembers.storeId} = ${invite.storeId} AND ${storeMembers.userId} = ${userId}`,
      );

    // Also check if they're the owner
    const storeResult = await tx
      .select()
      .from(stores)
      .where(eq(stores.id, invite.storeId));
    const store = storeResult[0];

    const isOwner = store?.userId === userId;

    if (!existing.length && !isOwner) {
      await tx.insert(storeMembers).values({
        storeId: invite.storeId,
        userId,
        role: invite.role,
      });
    }

    await tx
      .update(storeInvites)
      .set({ claimedAt: new Date() })
      .where(eq(storeInvites.token, token));

    return invite.storeId;
  });
}
