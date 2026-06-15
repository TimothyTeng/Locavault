import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { FIXTURE_IDS } from "~/types/fixtureTypes";

// ─── STORES ────────────────────────────────────────────────

export const stores = sqliteTable("stores", {
  id:            text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:          text("name").notNull(),
  tags:          text("tags").notNull().default("[]"),
  description:   text("description"),
  rows:          integer("rows").notNull().default(10),
  cols:          integer("cols").notNull().default(10),
  userId:        text("user_id").notNull(),
  createdAt:     integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  isPublic:      integer("is_public",      { mode: "boolean" }).notNull().default(false),
  canvasVisible: integer("canvas_visible", { mode: "boolean" }).notNull().default(false),
});

// ─── BLOCKS ────────────────────────────────────────────────

export const blocks = sqliteTable("blocks", {
  block_id:   text("block_id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId:    text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  background: text("background").notNull().default("#000000"),
  border:     text("border").notNull().default("#000000"),
  label:      text("label").notNull().default(""),
  height:     integer("height").notNull().default(1),
  width:      integer("width").notNull().default(1),
  x:          integer("x").notNull().default(0),
  y:          integer("y").notNull().default(0),
  kind:       text("kind", { enum: ["standard", "divider", "stairs"] }).notNull().default("standard"),
  fixture:    text("fixture", { enum: FIXTURE_IDS }),  // null = plain coloured block
});

// ─── ITEMS ─────────────────────────────────────────────────

export const items = sqliteTable("items", {
  id:            text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:          text("name").notNull(),
  quantity:      integer("quantity").notNull().default(0),
  description:   text("description"),
  storeId:       text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  blockId:       text("block_id").references(() => blocks.block_id, { onDelete: "set null" }),
  createdAt:     integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  isPublic:      integer("is_public", { mode: "boolean" }).notNull().default(true),
  // ── New fields ──
  itemType:      text("item_type", { enum: ["food", "medication", "supplies", "equipment", "clothing", "document", "other"] }).notNull().default("other"),
  sku:           text("sku"),
  unit:          text("unit"),
  minQuantity:   integer("min_quantity"),
  cost:          integer("cost"),                                                    // cents
  expiryDate:    integer("expiry_date", { mode: "timestamp" }),
  useRate:       integer("use_rate"),                                                // units per period
  useRatePeriod: text("use_rate_period", { enum: ["day", "week", "month"] }),
});

// ─── ITEM LOGS ─────────────────────────────────────────────

export const itemLogs = sqliteTable("item_logs", {
  id:       text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  itemId:   text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  storeId:  text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  delta:    integer("delta").notNull(),      // negative = consumed, positive = restocked
  note:     text("note"),
  loggedAt: integer("logged_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  loggedBy: text("logged_by"),               // userId
});

// ─── COLLABORATION  ───────────────────────────────

export const storeMembers = sqliteTable("store_members", {
  id:       text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId:  text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  userId:   text("user_id").notNull(),
  role:     text("role", { enum: ["owner", "editor", "viewer"] }).notNull(),
  joinedAt: integer("joined_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const storeInvites = sqliteTable("store_invites", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId:   text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  role:      text("role", { enum: ["editor"] }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  claimedAt: integer("claimed_at", { mode: "timestamp" }),
  createdBy: text("created_by").notNull(),
});

// ─── PURCHASE ORDER ITEMS ──────────────────────────────────

export const purchaseOrderItems = sqliteTable("purchase_order_items", {
  id:            text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id").references(() => items.id, { onDelete: "set null" }),
  storeId:       text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  name:          text("name").notNull(),
  quantity:      integer("quantity").notNull().default(1),
  blockId:       text("block_id").references(() => blocks.block_id, { onDelete: "set null" }),
  description:   text("description"),
  sku:           text("sku"),
  unit:          text("unit"),
  minQuantity:   integer("min_quantity"),
  cost:          integer("cost"),
  expiryDate:    integer("expiry_date", { mode: "timestamp" }),
  useRate:       integer("use_rate"),
  useRatePeriod: text("use_rate_period", { enum: ["day", "week", "month"] }),
  createdAt:     integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  createdBy:     text("created_by"),
});

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  store: one(stores, { fields: [purchaseOrderItems.storeId], references: [stores.id] }),
  block: one(blocks, { fields: [purchaseOrderItems.blockId], references: [blocks.block_id] }),
}));

// ─── TEMPLATES ─────────────────────────────────────────────
// A reusable, shareable store layout (blocks only — no items). Any signed-in
// user can create templates and instantiate stores from public ones.

export const templates = sqliteTable("templates", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:        text("name").notNull(),
  description: text("description"),
  tags:        text("tags").notNull().default("[]"),
  rows:        integer("rows").notNull().default(10),
  cols:        integer("cols").notNull().default(10),
  userId:      text("user_id").notNull(),                       // creator (Clerk id)
  isPublic:    integer("is_public", { mode: "boolean" }).notNull().default(false),
  usageCount:  integer("usage_count").notNull().default(0),
  createdAt:   integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const templateBlocks = sqliteTable("template_blocks", {
  block_id:   text("block_id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  templateId: text("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
  background: text("background").notNull().default("#000000"),
  border:     text("border").notNull().default("#000000"),
  label:      text("label").notNull().default(""),
  height:     integer("height").notNull().default(1),
  width:      integer("width").notNull().default(1),
  x:          integer("x").notNull().default(0),
  y:          integer("y").notNull().default(0),
  kind:       text("kind", { enum: ["standard", "divider", "stairs"] }).notNull().default("standard"),
  fixture:    text("fixture", { enum: FIXTURE_IDS }),  // null = plain coloured block
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

// ─── RELATIONS ─────────────────────────────────────────────

export const storesRelations = relations(stores, ({ many }) => ({
  items:    many(items),
  blocks:   many(blocks),
  members:  many(storeMembers),
  invites:  many(storeInvites),
  itemLogs: many(itemLogs),
  purchaseOrderItems: many(purchaseOrderItems),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
  store: one(stores, { fields: [blocks.storeId], references: [stores.id] }),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  store:    one(stores, { fields: [items.storeId], references: [stores.id] }),
  itemLogs: many(itemLogs),
}));

export const itemLogsRelations = relations(itemLogs, ({ one }) => ({
  item:  one(items,  { fields: [itemLogs.itemId],  references: [items.id]  }),
  store: one(stores, { fields: [itemLogs.storeId], references: [stores.id] }),
}));

export const storeMembersRelations = relations(storeMembers, ({ one }) => ({
  store: one(stores, { fields: [storeMembers.storeId], references: [stores.id] }),
}));

export const storeInvitesRelations = relations(storeInvites, ({ one }) => ({
  store: one(stores, { fields: [storeInvites.storeId], references: [stores.id] }),
}));