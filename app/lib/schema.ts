import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

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
  // A built-in FixtureId or a custom "cf_<id>" (see customFixtures); null = plain.
  fixture: text("fixture"),
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
  // Snooze/dismiss for this item's alerts (DESIGN.md §6): while set to a future
  // time, getItemStatus suppresses its low/expiring/dose signals. Null = active.
  alertSnoozedUntil: integer("alert_snoozed_until", { mode: "timestamp" }),
  // ── Durable-trait fields (equipment & other long-lived goods) ──
  // Warranty expiry (surfaces as an info alert as it approaches), a serial number
  // for registration/claims, physical condition, and a maintenance cadence:
  // `maintenanceIntervalDays` + `lastMaintainedAt` drive a "service due" signal.
  warrantyUntil: integer("warranty_until", { mode: "timestamp" }),
  serialNumber: text("serial_number"),
  condition: text("condition", {
    enum: ["new", "good", "worn", "broken"],
  }),
  maintenanceIntervalDays: integer("maintenance_interval_days"),
  lastMaintainedAt: integer("last_maintained_at", { mode: "timestamp" }),
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
  // Total spend for this event, in cents (snapshot of unit cost × delta at the
  // time of purchase). Only set on restock/buy rows; null everywhere else. Lets
  // spend be reconstructed historically even after an item's `cost` changes.
  costCents: integer("cost_cents"),
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
  // Mirrors items.itemType so an inferred/confirmed type flows through to the
  // bought item (instead of always defaulting to "other"). Drives traits →
  // recipe matching + run-out prediction.
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
  // Free-text "what it comes in" (e.g. "500 g"), captured opportunistically from
  // a barcode scan — shown so the user knows the pack amount; never parsed into
  // the (package-count) quantity.
  packageSize: text("package_size"),
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

// ─── NAME → TYPE CONSENSUS (crowd inference cache) ─────────
// Materialised k-anonymous name→type map — Stage B of smart shopping-list
// capture: the durable, cross-restart/cross-instance successor to the in-process
// crowd cache. Rebuilt by `recomputeTypeConsensus` (lazily, when stale) from
// everyone's items + PO rows and read by `getCrowdTypeHints` to seed inference.
// `name` is a `canonicalNameKey` (tokenised — never a raw, user-facing name). A
// reserved "__lastrun__" sentinel row (a value canonicalNameKey can never emit)
// records the last rebuild time so an empty result isn't mistaken for "never ran".
export const nameTypeConsensus = sqliteTable("name_type_consensus", {
  name: text("name").primaryKey(),
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
  }).notNull(),
  // Distinct users backing the winning type — a k-anonymity/confidence witness.
  userCount: integer("user_count").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

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
  // A built-in FixtureId or a custom "cf_<id>" (see customFixtures); null = plain.
  fixture: text("fixture"),
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

// ─── CUSTOM FIXTURES ───────────────────────────────────────
// A user-authored fixture: a named set of base shapes (drawn in the freeform
// editor) usable on blocks like the built-ins. `shapes` is a JSON CustomShape[]
// in a normalised 0–100 box; colours resolve from the block's colour at render
// time. Referenced by blocks/template_blocks via `fixture = "cf_<id>"`.
export const customFixtures = sqliteTable("custom_fixtures", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => `cf_${crypto.randomUUID()}`),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["storage", "furniture", "appliance", "object"],
  })
    .notNull()
    .default("object"),
  defaultColor: text("default_color").notNull().default("#64748b"),
  shapes: text("shapes").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

// ─── RECIPES ───────────────────────────────────────────────
// A user's saved recipe library (DESIGN.md §7). User-scoped like customFixtures
// (no store FK) — recipes are matched against whichever store's pantry is open.
// Ingredients / steps / tags are JSON columns (mirrors customFixtures.shapes):
// they always load together and we never query an individual ingredient across
// recipes. `imageUrl` is a plain URL (no upload infra) — auto-filled by the
// JSON-LD URL importer. See app/types/recipeTypes.ts for the JSON shapes.

export const recipes = sqliteTable("recipes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => `ur_${crypto.randomUUID()}`),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  blurb: text("blurb"),
  imageUrl: text("image_url"),
  sourceUrl: text("source_url"),
  // JSON: { name: string; amount?: number; unit?: string }[]
  ingredients: text("ingredients").notNull().default("[]"),
  // JSON: { text: string; imageUrl?: string }[]
  steps: text("steps").notNull().default("[]"),
  // JSON: string[]
  tags: text("tags").notNull().default("[]"),
  minutes: integer("minutes"),
  serves: integer("serves"),
  // Recipe sharing ("template recipes", DESIGN §7 / templates pattern): a public
  // recipe is visible to everyone and copyable; `usageCount` bumps on each copy.
  // Only name/photo/steps/ingredients are shared — never inventory.
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

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
  // A reusable template list ("camping kit") — never checks out; you "start from"
  // it to spawn a fresh active collection.
  isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
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

// ─── MEAL PLAN ─────────────────────────────────────────────
// A recipe scheduled on a day (DESIGN.md §7). Per-store planning data (like
// collections / shopping list — owner/editor only). `recipeRef` is a recipe id
// (a `ur_*` user recipe or a seeded id) so it is intentionally NOT a FK;
// `recipeName` is denormalised so the entry still reads if the recipe is deleted.

export const scheduledMeals = sqliteTable("scheduled_meals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  storeId: text("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  recipeRef: text("recipe_ref").notNull(),
  recipeName: text("recipe_name").notNull(),
  // Local "YYYY-MM-DD" — date-only, so a planned day never drifts by timezone.
  dateKey: text("date_key").notNull(),
  mealType: text("meal_type", {
    enum: ["breakfast", "lunch", "dinner", "snack"],
  })
    .notNull()
    .default("dinner"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const scheduledMealsRelations = relations(scheduledMeals, ({ one }) => ({
  store: one(stores, {
    fields: [scheduledMeals.storeId],
    references: [stores.id],
  }),
}));

// ─── DOSE SCHEDULES (reminders v1) ─────────────────────────
// An opt-in "take N times a day" schedule for a medication item (DESIGN.md §4/§6).
// User-scoped (whoever tracks it) but FK'd to the item so it's removed with it.
// `timesPerDay` slots are spread evenly across waking hours (see dose.helper);
// `endDate` null = ongoing/indefinite. Taking a dose is recorded as an itemLogs
// row (delta −1, note "dose"), so adherence + refill prediction reuse existing
// machinery rather than a second store of truth.

export const doseSchedules = sqliteTable("dose_schedules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  timesPerDay: integer("times_per_day").notNull().default(1),
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }), // null = ongoing
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const doseSchedulesRelations = relations(doseSchedules, ({ one }) => ({
  item: one(items, {
    fields: [doseSchedules.itemId],
    references: [items.id],
  }),
}));

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
    enum: ["pending", "accepted", "declined", "cancelled", "completed"],
  })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  // Set when either party marks an accepted swap as physically done.
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const tradeOffersRelations = relations(tradeOffers, ({ one, many }) => ({
  listingItem: one(items, {
    fields: [tradeOffers.listingItemId],
    references: [items.id],
  }),
  listingStore: one(stores, {
    fields: [tradeOffers.listingStoreId],
    references: [stores.id],
  }),
  messages: many(tradeMessages),
}));

// ─── TRADE MESSAGES ────────────────────────────────────────
// A per-offer contact thread. The swap itself is physical/offline — this is how
// the two parties arrange the handoff once an offer is accepted. Only the two
// participants of an accepted offer may read/post (authorised in the action).

export const tradeMessages = sqliteTable("trade_messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  offerId: text("offer_id")
    .notNull()
    .references(() => tradeOffers.id, { onDelete: "cascade" }),
  fromUserId: text("from_user_id").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const tradeMessagesRelations = relations(tradeMessages, ({ one }) => ({
  offer: one(tradeOffers, {
    fields: [tradeMessages.offerId],
    references: [tradeOffers.id],
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
  scheduledMeals: many(scheduledMeals),
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
