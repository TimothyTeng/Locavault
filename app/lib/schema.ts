import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { FIXTURE_IDS } from "~/types/fixtureTypes";

// ─── STORES ────────────────────────────────────────────────

export const stores = sqliteTable("stores", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  tags: text("tags").notNull().default("[]"),
  description: text("description"),
  rows: integer("rows").notNull().default(10),
  cols: integer("cols").notNull().default(10),
  // Edge-based wall layer: JSON array of { x, y, dir } segments (see wallTypes).
  walls: text("walls").notNull().default("[]"),
  userId: text("user_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  canvasVisible: integer("canvas_visible", { mode: "boolean" })
    .notNull()
    .default(false),
});

// ─── BLOCKS ────────────────────────────────────────────────

export const blocks = sqliteTable("blocks", {
  block_id: text("block_id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  storeId: text("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  background: text("background").notNull().default("#000000"),
  border: text("border").notNull().default("#000000"),
  label: text("label").notNull().default(""),
  height: integer("height").notNull().default(1),
  width: integer("width").notNull().default(1),
  x: integer("x").notNull().default(0),
  y: integer("y").notNull().default(0),
  kind: text("kind", { enum: ["standard", "divider", "stairs", "room"] })
    .notNull()
    .default("standard"),
  fixture: text("fixture", { enum: FIXTURE_IDS }), // null = plain coloured block
});

// ─── ITEMS ─────────────────────────────────────────────────

export const items = sqliteTable("items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(0),
  description: text("description"),
  storeId: text("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  blockId: text("block_id").references(() => blocks.block_id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  // ── New fields ──
  itemType: text("item_type", {
    enum: [
      "food",
      "medication",
      "supplies",
      "equipment",
      "clothing",
      "document",
      "other",
    ],
  })
    .notNull()
    .default("other"),
  sku: text("sku"),
  unit: text("unit"),
  minQuantity: integer("min_quantity"),
  cost: integer("cost"), // cents
  expiryDate: integer("expiry_date", { mode: "timestamp" }),
  useRate: integer("use_rate"), // units per period
  useRatePeriod: text("use_rate_period", { enum: ["day", "week", "month"] }),
  // Transient "loan" state: true while the item is packed/checked-out in a
  // collection (it physically left the store but keeps its home blockId for
  // put-away on return). See DESIGN.md §7. Does NOT decrement quantity.
  checkedOut: integer("checked_out", { mode: "boolean" })
    .notNull()
    .default(false),
  // Trade / loan (DESIGN.md §7): owner opts a surplus item onto the global
  // Bazaar. `tradeNote` is the optional "looking for…" (wants) line.
  forTrade: integer("for_trade", { mode: "boolean" }).notNull().default(false),
  tradeNote: text("trade_note"),
});

// ─── ITEM LOGS ─────────────────────────────────────────────

export const itemLogs = sqliteTable("item_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  storeId: text("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(), // negative = consumed, positive = restocked
  note: text("note"),
  loggedAt: integer("logged_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  loggedBy: text("logged_by"), // userId
});

// ─── COLLABORATION  ───────────────────────────────

export const storeMembers = sqliteTable("store_members", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  storeId: text("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role", { enum: ["owner", "editor", "viewer"] }).notNull(),
  joinedAt: integer("joined_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const storeInvites = sqliteTable("store_invites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  storeId: text("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  role: text("role", { enum: ["editor"] }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  claimedAt: integer("claimed_at", { mode: "timestamp" }),
  createdBy: text("created_by").notNull(),
});

// ─── PURCHASE ORDER ITEMS ──────────────────────────────────

export const purchaseOrderItems = sqliteTable("purchase_order_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id").references(() => items.id, { onDelete: "set null" }),
  storeId: text("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  blockId: text("block_id").references(() => blocks.block_id, {
    onDelete: "set null",
  }),
  description: text("description"),
  sku: text("sku"),
  unit: text("unit"),
  minQuantity: integer("min_quantity"),
  cost: integer("cost"),
  expiryDate: integer("expiry_date", { mode: "timestamp" }),
  useRate: integer("use_rate"),
  useRatePeriod: text("use_rate_period", { enum: ["day", "week", "month"] }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  createdBy: text("created_by"),
});

export const purchaseOrderItemsRelations = relations(
  purchaseOrderItems,
  ({ one }) => ({
    store: one(stores, {
      fields: [purchaseOrderItems.storeId],
      references: [stores.id],
    }),
    block: one(blocks, {
      fields: [purchaseOrderItems.blockId],
      references: [blocks.block_id],
    }),
  }),
);

// ─── TEMPLATES ─────────────────────────────────────────────
// A reusable, shareable store layout (blocks only — no items). Any signed-in
// user can create templates and instantiate stores from public ones.

export const templates = sqliteTable("templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  tags: text("tags").notNull().default("[]"),
  rows: integer("rows").notNull().default(10),
  cols: integer("cols").notNull().default(10),
  walls: text("walls").notNull().default("[]"), // edge-based wall layer (JSON)
  userId: text("user_id").notNull(), // creator (Clerk id)
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const templateBlocks = sqliteTable("template_blocks", {
  block_id: text("block_id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  templateId: text("template_id")
    .notNull()
    .references(() => templates.id, { onDelete: "cascade" }),
  background: text("background").notNull().default("#000000"),
  border: text("border").notNull().default("#000000"),
  label: text("label").notNull().default(""),
  height: integer("height").notNull().default(1),
  width: integer("width").notNull().default(1),
  x: integer("x").notNull().default(0),
  y: integer("y").notNull().default(0),
  kind: text("kind", { enum: ["standard", "divider", "stairs", "room"] })
    .notNull()
    .default("standard"),
  fixture: text("fixture", { enum: FIXTURE_IDS }), // null = plain coloured block
});

export const templatesRelations = relations(templates, ({ many }) => ({
  blocks: many(templateBlocks),
}));

export const templateBlocksRelations = relations(templateBlocks, ({ one }) => ({
  template: one(templates, {
    fields: [templateBlocks.templateId],
    references: [templates.id],
  }),
}));

// ─── COLLECTIONS / PACKING ─────────────────────────────────
// A named set of item references for a purpose (packing a trip, a trade pile,
// a custom group) — distinct from the shopping list (things to acquire). v1 is
// per-store but the model is kept store-agnostic so a later global / cross-store
// layer is a small step. See DESIGN.md §7.

export const collections = sqliteTable("collections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  storeId: text("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  kind: text("kind", { enum: ["packing", "trade", "custom"] })
    .notNull()
    .default("packing"),
  // Collection-level state: true once it's been "checked out" (taken out).
  checkedOut: integer("checked_out", { mode: "boolean" })
    .notNull()
    .default(false),
  userId: text("user_id").notNull(), // creator (Clerk id)
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const collectionItems = sqliteTable("collection_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  collectionId: text("collection_id")
    .notNull()
    .references(() => collections.id, { onDelete: "cascade" }),
  // Link to an owned item (for pick assistance + check-out), or null for a
  // free-text desired thing (gap → shopping list).
  itemId: text("item_id").references(() => items.id, { onDelete: "set null" }),
  name: text("name").notNull(), // denormalised label
  desiredQty: integer("desired_qty").notNull().default(1),
  checked: integer("checked", { mode: "boolean" }).notNull().default(false), // "packed" tick
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  store: one(stores, {
    fields: [collections.storeId],
    references: [stores.id],
  }),
  items: many(collectionItems),
}));

export const collectionItemsRelations = relations(
  collectionItems,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionItems.collectionId],
      references: [collections.id],
    }),
    item: one(items, {
      fields: [collectionItems.itemId],
      references: [items.id],
    }),
  }),
);

// ─── TRADE OFFERS ──────────────────────────────────────────
// Steam-style trade offers on a Bazaar listing: a requester proposes a swap for
// someone else's listed item, optionally offering one of their own listings in
// return. Names are denormalised so an offer still reads if an item is later
// deleted/unlisted. See DESIGN.md §7.

export const tradeOffers = sqliteTable("trade_offers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  listingItemId: text("listing_item_id").references(() => items.id, {
    onDelete: "set null",
  }),
  listingStoreId: text("listing_store_id").references(() => stores.id, {
    onDelete: "set null",
  }),
  listingName: text("listing_name").notNull(),
  offeredItemId: text("offered_item_id").references(() => items.id, {
    onDelete: "set null",
  }),
  offeredName: text("offered_name"),
  fromUserId: text("from_user_id").notNull(), // requester
  toUserId: text("to_user_id").notNull(), // listing owner
  message: text("message"),
  status: text("status", {
    enum: ["pending", "accepted", "declined", "cancelled"],
  })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const tradeOffersRelations = relations(tradeOffers, ({ one }) => ({
  listingItem: one(items, {
    fields: [tradeOffers.listingItemId],
    references: [items.id],
  }),
  listingStore: one(stores, {
    fields: [tradeOffers.listingStoreId],
    references: [stores.id],
  }),
}));

// ─── RELATIONS ─────────────────────────────────────────────

export const storesRelations = relations(stores, ({ many }) => ({
  items: many(items),
  blocks: many(blocks),
  members: many(storeMembers),
  invites: many(storeInvites),
  itemLogs: many(itemLogs),
  purchaseOrderItems: many(purchaseOrderItems),
  collections: many(collections),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
  store: one(stores, { fields: [blocks.storeId], references: [stores.id] }),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  store: one(stores, { fields: [items.storeId], references: [stores.id] }),
  itemLogs: many(itemLogs),
}));

export const itemLogsRelations = relations(itemLogs, ({ one }) => ({
  item: one(items, { fields: [itemLogs.itemId], references: [items.id] }),
  store: one(stores, { fields: [itemLogs.storeId], references: [stores.id] }),
}));

export const storeMembersRelations = relations(storeMembers, ({ one }) => ({
  store: one(stores, {
    fields: [storeMembers.storeId],
    references: [stores.id],
  }),
}));

export const storeInvitesRelations = relations(storeInvites, ({ one }) => ({
  store: one(stores, {
    fields: [storeInvites.storeId],
    references: [stores.id],
  }),
}));
