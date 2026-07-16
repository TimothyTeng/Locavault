// Item taxonomy: the *type* of a thing (drives which fields & behaviours apply),
// distinct from a *category* (how the user groups things — that lives on the
// canvas as zones / block labels). See DESIGN.md §5.

/** Capabilities an item can have. Each switches on a field group + a behaviour. */
export type Trait =
  | "perishable" // expiry → freshness alerts
  | "depletes" // use-rate, min qty → run-out prediction + shopping list
  | "edible" // unit → recipes
  | "dosed" // dose, schedule, refill → med reminders (future fields)
  | "durable" // warranty, serial, condition → maintenance/trade (future fields)
  | "sized"; // size, season → packing lists (future fields)

/** The fixed, app-controlled set of item types the user picks from. */
export type ItemType =
  | "food"
  | "medication"
  | "supplies"
  | "equipment"
  | "clothing"
  | "document"
  | "other";

/** Physical condition of a durable item (equipment etc.). */
export type Condition = "new" | "good" | "worn" | "broken";

/** Seasonal bucket of a sized item (clothing etc.) — drives rotation nudges. */
export type Season = "all" | "summer" | "winter" | "transitional";
