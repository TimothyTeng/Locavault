import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const stores = sqliteTable("stores", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:        text("name").notNull(),
  tags:        text("tags").notNull().default("[]"),
  description: text("description"),
  rows:        integer("rows").notNull().default(10),
  cols:        integer("cols").notNull().default(10),
  userId:      text("user_id").notNull(),
  createdAt:   integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
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
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const storesRelations = relations(stores, ({ many }) => ({
  items:  many(items),
  blocks: many(blocks),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
  store: one(stores, {
    fields: [blocks.storeId],
    references: [stores.id],
  }),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  store: one(stores, {
    fields: [items.storeId],
    references: [stores.id],
  }),
}));