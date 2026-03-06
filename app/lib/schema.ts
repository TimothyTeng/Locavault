// schema.ts
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const stores = sqliteTable("stores", {  // ← renamed variable to stores
  id:       text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:     text("name").notNull(),
  width:    integer("width").notNull().default(10),
  height:   integer("height").notNull().default(10),
  grid:     text("grid").notNull().default("[]"),
  userId:   text("user_id").notNull(),
});

export const items = sqliteTable("items", {
  id:          text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:        text("name").notNull(),
  quantity:    integer("quantity").notNull().default(0),
  description: text("description"),
  storeId:     text("store_id").notNull().references(() => stores.id, {
    onDelete: "cascade",
  }),
  xCord:     integer("x_coord").notNull().default(0),
  yCord:     integer("y_coord").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Relations
export const storesRelations = relations(stores, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  store: one(stores, {
    fields: [items.storeId],
    references: [stores.id],
  }),
}));