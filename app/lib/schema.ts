import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const stores = sqliteTable("stores", {
  id:            text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:          text("name").notNull(),
  tags:          text("tags").notNull().default("[]"),
  description:   text("description"),
  rows:          integer("rows").notNull().default(10),
  cols:          integer("cols").notNull().default(10),
  userId:        text("user_id").notNull(),
  createdAt:     integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  // Phase 3
  isPublic:      integer("is_public",      { mode: "boolean" }).notNull().default(false),
  canvasVisible: integer("canvas_visible", { mode: "boolean" }).notNull().default(false),
});

export const blocks = sqliteTable("blocks", {
  block_id:   text("block_id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId:    text("store_id").notNull().references(() => stores.id, {
    onDelete: "cascade",
  }),
  background: text("background").notNull().default("#000000"),
  border:     text("border").notNull().default("#000000"),
  label:      text("label").notNull().default(""),
  height:     integer("height").notNull().default(1),
  width:      integer("width").notNull().default(1),
  x:          integer("x").notNull().default(0),
  y:          integer("y").notNull().default(0),
});

export const items = sqliteTable("items", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:        text("name").notNull(),
  quantity:    integer("quantity").notNull().default(0),
  description: text("description"),
  storeId:     text("store_id").notNull().references(() => stores.id, {
    onDelete: "cascade",
  }),
  blockId:     text("block_id").references(() => blocks.block_id, {
    onDelete: "set null",
  }),
  createdAt:   integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  // Phase 3
  isPublic:    integer("is_public", { mode: "boolean" }).notNull().default(true),
});

// Phase 3 — collaboration tables

export const storeMembers = sqliteTable("store_members", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId:   text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  userId:    text("user_id").notNull(),
  role:      text("role", { enum: ["owner", "editor", "viewer"] }).notNull(),
  joinedAt:  integer("joined_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const storeInvites = sqliteTable("store_invites", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId:     text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  token:       text("token").notNull().unique(),
  role:        text("role", { enum: ["editor", "viewer"] }).notNull(),
  expiresAt:   integer("expires_at", { mode: "timestamp" }).notNull(),
  claimedAt:   integer("claimed_at", { mode: "timestamp" }),
  createdBy:   text("created_by").notNull(),
});

// ── Relations ──────────────────────────────────────────────

export const storesRelations = relations(stores, ({ many }) => ({
  items:       many(items),
  blocks:      many(blocks),
  members:     many(storeMembers),
  invites:     many(storeInvites),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
  store: one(stores, {
    fields:     [blocks.storeId],
    references: [stores.id],
  }),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  store: one(stores, {
    fields:     [items.storeId],
    references: [stores.id],
  }),
}));

export const storeMembersRelations = relations(storeMembers, ({ one }) => ({
  store: one(stores, {
    fields:     [storeMembers.storeId],
    references: [stores.id],
  }),
}));

export const storeInvitesRelations = relations(storeInvites, ({ one }) => ({
  store: one(stores, {
    fields:     [storeInvites.storeId],
    references: [stores.id],
  }),
}));