# Locavault — Design Direction

> Living design doc. Captures the product direction, the reasoning behind it,
> and the decisions made so far. Status tags: **[DECIDED]**, **[LEANING]**,
> **[OPEN]**. Update as we ideate.

---

## 1. Positioning

**Home inventory, food-first.** Not "inventory management for any physical
location" (too generic to market), not "food only" (wastes the spatial canvas).
The center of gravity is the **home**: pantry, fridge, cleaning, bathroom,
wardrobe, garage, home office — which is exactly what the starter templates
already are.

- **Food-first is a go-to-market and onboarding decision, not a feature-scoping
  one.** Features stay general (the engine is category-agnostic); food just gets
  the richest auto-fill and leads the demo because the pain is visceral and the
  data exists.
- Avoid chasing enterprise/warehouse features (mass SKU import, multi-site,
  integrations, label printing) — that's a different product.

### The one-line promise

> **Know what you're running out of before you do, find anything in seconds, and
> cook from what you keep — without logging your life.**

Differentiation:
- vs. a **notes app** → the *prediction* (a list can't tell you when you'll run out).
- vs. **accounting software** → the *spatial + recipe intelligence*.
- vs. **Grocy** → it does *not* require you to be the receiving clerk.

---

## 2. Core philosophy (the constraint that shapes everything) **[DECIDED]**

**No manual outflow logging, ever, as a requirement.** Nobody will record "2
slices of ham, 3 squirts of mustard" for a midnight sandwich. Any product whose
accuracy depends on the user reporting consumption goes stale in two weeks and
then actively lies. This is Grocy's fatal assumption — the home is not a
warehouse.

Therefore:

- **Track *inflow*, infer consumption from *cadence*.** If you re-buy milk every
  ~6 days, your consumption *is* ~1 / 6 days. Reorder intervals are the
  consumption signal. Buying is discrete, batchable, and near-free to capture
  (receipt / barcode / import) — unlike metering every pour.
- **Predict only what's predictable.** Scope prediction to the ~20–30 recurring
  staples people actually rebuy and run out of. **Concede that the exact level of
  a half-eaten bag of chips is unknowable and not worth knowing** — don't pretend
  otherwise. Predicting only the predictable is what keeps it honest.
- **Probabilistic, gentle output — not hard numbers.** "Likely need milk this
  week," not "3.2 days left." The model's honest imprecision and the calm,
  non-imposing UX are the *same* design choice. Rendering noise as precise numbers
  reads as "the app is wrong" → churn.

### The only two behaviors we ask of the user **[DECIDED]**

| Direction | Interaction | Cost |
| --- | --- | --- |
| **IN** | Purchases (receipt / barcode / import) | ~free, once per shop |
| **OUT** | A single **"out / running low"** tap, when it naturally happens | one tap, at the moment you care |

The "out" tap is the one outflow event people *will* do (it's what triggers
rebuying) and it's a gold-standard calibration point: it confirms a full cycle
was consumed between purchases. Anything finer-grained we explicitly refuse to
ask for. An optional "quick count" may exist for power users — never required,
never nagged.

> Implementation note: the existing usage predictor (recency-weighted, in
> `usage.helper.ts` / `store.loader.ts`) already works from coarse `itemLogs`
> events. It just needs to be fed **purchase events (inflow)** and **"out" taps**
> rather than fine-grained quantity edits.

---

## 3. Prediction engine

> Builds on §2: we predict from **inflow + the "out" tap**, never metered
> outflow. Output is always a *distribution / gentle estimate*, never a hard
> number.

### What we're actually predicting

Three classic problems, not "regression on a use rate":

1. **Inter-purchase interval (IPI)** — how often you rebuy.
2. **Survival / time-to-event** — when it runs out, with **right-censoring** (the
   current cycle isn't finished — must not be treated as "lasts forever").
3. **Demand forecasting** — units per period, possibly seasonal.

The data is sparse (an item is rebought maybe tens of times/year), irregular,
censored, non-stationary (habits drift), and **hierarchical** (item → household →
population). The hierarchy is the main lever.

### Headline decision **[DECIDED]**

**Statistics + Bayes first; ML only at population scale.** For one household's
sparse data a hierarchical Bayesian estimate beats a neural net and is cheaper,
interpretable, cold-start-friendly, and runs in TypeScript at the edge. Heavy ML
earns its place only as a *global* model that supplies priors the local layer
then personalizes. Do not reach for deep learning to predict when you'll run out
of eggs from six data points.

### Two-layer architecture **[LEANING]**

```
GLOBAL (offline, at scale, ML)              LOCAL (runtime, per household, Bayesian)
──────────────────────────────             ──────────────────────────────────────────
LightGBM / DeepAR over ALL households  →    prior rate ─┐
features: category, pack size, season,                   ├─ Bayesian update with this
household size, region, price …                          │  household's purchases + "out" taps
→ prior consumption rate / distribution  observations ──┘  → personalized posterior → gentle estimate
```

- **Cold start** = the global prior (a brand-new user instantly gets "average
  household milk cadence," refined as they shop).
- **Personalization** = the cheap local Bayesian update — no retraining, never
  blocks a request.
- The global model runs **offline (batch)** and writes priors back to Turso.

### Method landscape (simple → at-scale)

| Family | Methods | When it fits |
| --- | --- | --- |
| Smoothing / baseline | EWMA, moving avg, median IPI | always — strong baseline (we have EWMA) |
| **Bayesian / hierarchical** | partial pooling, empirical-Bayes shrinkage, Gamma-Poisson | **now — the sweet spot; fixes cold start** |
| CLV "buy-till-you-die" | BG/NBD, Pareto/NBD, Gamma-Gamma | next-purchase timing from sparse purchase logs |
| Survival | Kaplan-Meier, Weibull AFT, Cox PH | time-to-runout with censoring; gives a distribution |
| Time-series | Holt-Winters/ETS, ARIMA, Prophet | once an item has history (seasonality) |
| ML (tabular) | LightGBM/XGBoost, XGBoost-AFT, random survival forests | at scale, feature-driven (M5-winning workhorse) |
| Deep / global | DeepAR, Temporal Fusion Transformer, N-BEATS | at scale — best fit for many short, sparse series |
| Embeddings / CF | item / household embeddings | cold-start priors ("households like yours") |

### Features that move accuracy

- **Item:** category (from OFF), pack size, unit, perishability, price.
- **Household:** size (# members — usually the biggest external signal),
  aggregate cadence, store mix.
- **Temporal:** season, month, day-of-week, holidays, recency/frequency.
- **Behavioral:** *variance* of past intervals (stable vs. erratic buyer → also
  sets how confident to be).

### Three pitfalls that silently wreck it

1. **Censoring.** "Hasn't run out yet" ≠ "lasts forever." Treating in-progress
   cycles as completed intervals systematically underestimates duration → use
   survival framing.
2. **Non-stationarity.** Habits drift; weight recent data / use online Bayesian
   updates rather than refitting all history equally.
3. **Wrong metric.** Output is a distribution → score with **pinball loss / CRPS**
   (proper scoring rules), not MAE on a point estimate. Optimizing a point is how
   you end up showing "3.2 days" and being confidently wrong — the exact failure
   mode we designed against.

### Staged roadmap **[LEANING]**

| Stage | Data reality | Approach |
| --- | --- | --- |
| **Now** | 1 household, sparse | EWMA (have) **+ category/population priors + Bayesian shrinkage**; pure TS; no ML |
| **Some history** | items with several cycles | add **seasonality** (Holt-Winters/Prophet-lite) + **survival-based run-out with censoring** |
| **At scale** | many users | offline **global GBM / DeepAR** → priors; local Bayesian personalization; embedding cold-start |

### Where it runs in our stack

- **Local layer:** plain TypeScript at runtime (extends `usage.helper.ts`).
- **Global layer:** a periodic offline Python job (`lifetimes`, `lifelines`,
  `Prophet`, `LightGBM`, `GluonTS`/DeepAR, `PyMC`/Stan) that writes rate priors to
  Turso. Never on the request path.

### Highest-leverage next step **[DECIDED]**

Not ML — add **category/population priors + Bayesian shrinkage** on top of the
existing recency-weighted estimator, framed as **survival-with-censoring**, output
as a **distribution**. That single change fixes cold-start and makes the "still
learning" state honest. The global ML model becomes worth building only once there
are many households to learn across.

---

## 4. Information architecture

### Two altitudes **[DECIDED]**

Mixing per-store and account-wide features is a top source of "where does this
go?" confusion. Split them:

| Level | Surfaces |
| --- | --- |
| **Global** (account) | Dashboard, Reminders / med timers (time-based), Trade / loan (social), Templates, Collections/packing (often span stores) |
| **Per-store** | Map (hub), Items, Recipes (food in *this* store), Shopping list |

Rule of thumb: time-based and people-based features are **global**; location- and
contents-based features are **per-store**.

### Store page: canvas-primary **[DECIDED]**

The map is the hub (the original vision); the old flat table is replaced by an
intent-driven panel.

```
┌───────────────────────────────────────────────────────────┐
│  🔍 search items…        [Map] Recipes  Lists      ⚙ + Add │  top bar: global search + tabs
├──────────────────────────────────┬────────────────────────┤
│                                   │  CONTEXT PANEL          │
│         CANVAS (hub)              │  (changes w/ selection) │
│   ┌────────┐  ┌────────┐          │  · nothing selected →   │
│   │ Pantry │  │ Fridge●│ ← status │    Store overview       │
│   └────────┘  └────────┘   badge  │  · zone selected →      │
│   ┌──────────────────┐            │    Zone contents        │
│   │ Cleaning         │            │  · item selected →      │
│   └──────────────────┘            │    Item detail          │
└──────────────────────────────────┴────────────────────────┘
```

1. **Canvas is a dashboard, not a diagram.** Each zone shows the highest-severity
   signal inside it + a count (e.g. "Fridge ●2"). Scanning the map = triage.
2. **Context panel, three states:**
   - *Nothing selected → Store overview*: an **action queue** grouped by intent
     (out/expired, expiring soon, running low → one-tap add-all to shopping list,
     doses due, warranty/docs) — **this replaces the flat table.** It's what needs
     you, not a dump of everything.
   - *Zone selected → Zone contents*: only that zone's items, rendered **per
     type** (food = cards with expiry badges; gear = plain rows).
   - *Item selected → Item detail* inline.
3. **Global search always present** — the "I don't know where it is" escape hatch
   so canvas-primary never traps you.
4. **Mobile:** canvas collapses to the existing MiniMap; context panel becomes
   full-screen with a bottom sheet for details.

---

## 5. Taxonomy: types, traits, categories **[DECIDED]**

### Type vs. category — do not conflate

- **Category** = how *you* group things ("snacks", "baking", "first aid"). This
  is personal and organizational → it lives on the **canvas as zones / block
  labels**. User-defined. "Spices" is a category, never a type.
- **Type** = the *nature* of the thing → drives which **fields and behaviors**
  apply. A small, fixed, app-controlled set.

Principle: **fixed types, custom categories.**

### Traits (the real primitive — ~6)

Each trait switches on a field group + a behavior:

| Trait | Adds to form | Drives |
| --- | --- | --- |
| **Perishable** | expiry date (optional) | expiry alerts |
| **Depletes** | use-rate, min qty | run-out prediction + shopping list |
| **Edible** | unit (g/ml/pcs) | recipes |
| **Dosed** | dose, schedule, refill-at | med reminders/timers |
| **Durable** | warranty, serial, condition | maintenance + trade |
| **Sized** | size, season/variant | packing lists |

`Perishable` means "show the expiry field" (optional to fill) — so rice/canned
goods are still Food with a blank expiry; no separate "pantry staple" type.

### Types (preset trait bundles — 7, what the user picks)

| Type | Traits | Form shows |
| --- | --- | --- |
| **Food** | edible · perishable · depletes | qty, unit, expiry, use-rate |
| **Medication** | dosed · perishable · depletes | qty, dose, schedule, expiry, refill-at |
| **Supplies** (cleaning, toiletries, paper, batteries) | depletes | qty, use-rate, min |
| **Equipment** (tools, electronics, appliances) | durable | qty, warranty, serial, condition |
| **Clothing** | sized | size, season, qty |
| **Documents** (passport, insurance, keys) | perishable (opt.) | location, expiry, notes |
| **Other** | — | qty, notes |

### Decisions

- **One type per item + optional extra trait for hybrids.** [DECIDED] A vitamin →
  pick *Medication*, or pick *Food* and toggle "track doses" to add the dosed
  fields. Common case stays one tap; hybrids possible without forcing multi-select
  on everyone. Form = union of active traits.
- **Engine reasons over traits, not type labels.** Features query "items with the
  `edible` trait", so adding a future type (Plants, Pets) is just a new bundle.
- **Edge cases absorbed by traits:** batteries → Supplies; flowers → Other +
  perishable (or a future Plants type); rice → Food, blank expiry.
- **Assignment is low-friction:** type self-defaults from context (Fridge/Pantry
  zone → Food; Bathroom → Supplies/Medication; Garage → Equipment; food barcode →
  Food). One dropdown (~7 + icons); switching keeps shared field values.
- **Back-compat:** existing items infer a type (has expiry/use-rate or in a food
  zone → Food; else Other), user can reassign.

---

## 6. Status & alerts **[DECIDED]**

### Trait → signal → severity

A trait can raise a signal with a severity + time horizon; the item shows the
**most urgent**, carried with a *reason* (specific labels, not just color):

| Trait | Signal | Severity |
| --- | --- | --- |
| Perishable | expired / expiring ≤ threshold | critical / attention |
| Depletes | out / below-min or predicted run-out soon | critical / attention |
| Dosed | refill needed soon | attention |
| Dosed | **dose due now** | **action** (not a problem) |
| Durable | warranty expiring | info |

### Tone: gentle, switchable, not imposing

- **Quiet by default.** Severity shown by *presence and placement* (a small dot on
  a zone, a soft pill on an item), never a wall of red.
- **Palette: neutral base, desaturated accents, dots over fills.** Saturated color
  appears only on the single most urgent thing on screen.
  - 🟢 ok (or neutral) · 🟠 soft amber = attention · 🔴 muted clay = critical ·
    🔵 soft blue = **action** (a task, e.g. a med dose — visually distinct from a
    *problem*).
- **Switchable everywhere:** per-item / per-type / per-store toggles ("track
  expiry: on/off", "remind me to restock: on/off"); snooze + dismiss on any alert.
- **Per-type thresholds.** Defaults differ by type (e.g. medication "refill soon"
  fires ~14d ahead for pharmacy lead time; food expiry ~7d).
- **Med doses are opt-in only, with a duration.** Never auto-created. The user
  sets "2× daily for 7 days" or "1× daily indefinitely." No schedule exists unless
  they make one.

### Three altitudes, same data

1. **Item** → pill + reason.
2. **Zone (canvas)** → highest severity inside + count; click a flagged zone →
   contents filtered to the issue.
3. **Store overview** → the action queue (see §4).

---

## 7. Feature surfaces

### Shopping list (INPUT) — exists, keep refining

The single *input* surface. Run-out predictions and recipe/packing gaps draft
entries into it; the user confirms. Distinct from collections (see below).

> ✅ *Done:* the **Shopping List panel** (`components/purchases/purchaseOrderPanel.tsx`)
> splits into two tabs:
> - **List** — the queue itself, plus an inline **"Needs restocking"** block
>   (`purchaseOrderSuggestions.tsx`) surfacing low/out/expiring items with one-tap
>   (and add-all) restock.
> - **Upcoming** (`purchaseOrderUpcoming.tsx`) — ingredients the calendar's
>   scheduled meals call for but the store is out of, scoped by a **timeframe**
>   selector (3 days / 1 week / 2 weeks / 1 month) and tagged with the soonest day
>   each is needed. One-tap (and add-all) → list. Fed by `MealNeed[]` (per-meal
>   day + missing-from-stock names) computed in `store.tsx`.
>
> "Buying" a row adds quantity to a linked item (or creates one) then clears the
> row; barcode scan + manual entry both add rows.

### Recipes (OUTPUT) — flagship **[DECIDED as first feature after core]**

Reads items with the `edible` trait. Three jobs:
- **Suggest recipes from what's available.**
- **Suggest recipes + list the lacking ingredients** → one tap to shopping list.
- **Save recipes.**

> ✅ *Done (v1):* per-store **Recipes panel** (`components/recipes/recipesPanel.tsx`,
> opened from the store toolbar — desktop + mobile, open to all access levels;
> add-to-list gated to editors). A **seeded library** (`lib/recipes.ts`, ~37
> common home recipes) is matched against the store's edible inventory by
> `matchRecipes` (`utils/helpers/recipes.helper.ts`) — **fuzzy, tokenized,
> de-pluralised matching against "what you keep", never exact counts** (e.g.
> "onion" ↔ "Red Onions"). Filters: **Cook now** (all on hand) / **Almost** (≤2
> missing) / **Mine**, each with a ring gauge. **Use it up** leads — recipes
> consuming items expiring ≤30d get an amber banner + a top-of-panel nudge.
>
> ✅ *Done (recipes module, 4 phases — see below):*
> - **User-saved library** (table `recipes`, `ur_*` ids, user-scoped — drops into
>   the matcher alongside the seeds). Create / edit / delete in a `RecipeEditor`
>   modal with structured **ingredients (amount + unit), steps (+ per-step image
>   URL), photo URL, tags, time, serves** (`types/recipeTypes.ts`).
> - **Import, search-first:** the editor searches **TheMealDB** (free public API,
>   `api.recipe-search.ts`) and fills the form from a result; a collapsible
>   **paste-a-URL** path parses `schema.org/Recipe` JSON-LD server-side with an
>   SSRF guard (`api.recipe-import.ts` + `recipeImport.helper.ts`). *(AllRecipes &
>   many big sites return 402/403 to any server fetch — empirically confirmed — so
>   search is the primary path; a paid discovery API can slot in via an env key.)*
> - **Ingredient ↔ map:** the detail view shows availability dots; an in-stock
>   ingredient links to its block (tap → pulse on the canvas). Two-way **add to
>   shopping list** — missing *or* on-hand (restock), per-row or all-at-once.
> - **Measurement-aware "Cooked this":** a servings ×N control decrements the
>   matched items, converting the recipe amount into each item's unit via a unit
>   registry (`utils/helpers/units.ts`, volume/mass/count) and logging the delta
>   so prediction learns from it (`recipeCook.helper.ts`). Quantity stays integer
>   (rounded) — "lenient, never exact". Items can declare a measured `unit` (datalist
>   on the add-item form), so e.g. "50 ml vanilla essence" decrements correctly.
> - **Schedule from a recipe:** an "Add to calendar" block (pick date + meal slot)
>   sits beside "Cooked", so planning isn't confined to the calendar tab.
> ⬜ *Remaining:* shopping-list rows added from a recipe land with no location
> block (`blockId: null`) — could inherit a same-name item's block or suggest one
> by type (parked, needs UX); a paid recipe-discovery API for breadth.

Design rules learned from the critique:
- **Volume comes from a seeded library and/or a recipe API** + user saves — *never*
  depend on the user authoring enough recipes. We use a seeded library + **TheMealDB
  search** + JSON-LD URL import; a paid API (Spoonacular / Edamam) stays a drop-in
  option behind an env key.
- **Match against "what you typically keep" (purchase profile), not exact
  counts.** Your buying history *is* your pantry. Avoid Grocy-style exact-quantity
  matching (it needs precise tracking we don't have); make it an in-the-moment
  manual opt-in if ever wanted.
- The **"use it up"** mode (recipes that use items expiring soon) is the emotional
  core of food-first — it actively prevents waste.

The reinforcing loop: track food → expiry/run-out signals → recipes suggest using
expiring items → **cooking logs consumption ("Cooked this")** → better prediction
→ smarter shopping list.

### Calendar & meal planning (OUTPUT) **[DECIDED]**

A per-store **calendar** in the side rail — deliberately named generically
("calendar", not "meal plan") so it can host other reminders/entry types later.
Today it plans meals; the planning → shopping loop is the point.

> ✅ *Done:* **Calendar panel** (`components/recipes/calendarPanel.tsx`,
> editor-only). Schedule recipes onto days in a **Week** or **Month** view
> (toggle; month is a 6×7 Monday-aligned grid with per-meal-type dots; prev/next
> steps by week or month; Today resets). Tap a month day → a **day-detail**
> sub-view to add/remove that day's meals. Each scheduled meal carries a slot
> (breakfast/lunch/dinner/snack). **Click a scheduled recipe → opens the recipes
> panel jumped to its detail** (works even for a seeded recipe with nothing in
> stock, via an `emptyMatch` fallback). **"What this week/month needs"** tallies
> every ingredient the period's recipes call for into *in-stock* vs *to-buy*, with
> one-tap (and all) add to the shopping list — the same `MealNeed[]` data feeds
> the shopping list's **Upcoming** tab. Date math is date-only local "YYYY-MM-DD"
> (`utils/helpers/calendar.helper.ts`, unit-tested) to avoid timezone drift.
> Persisted in the `scheduled_meals` table (per-store; `recipeRef` is a recipe id,
> not an FK, since seeds aren't in the DB; `recipeName` denormalised so an entry
> still reads after a recipe is deleted).
> ⬜ *Remaining:* non-meal reminders / entry types (the generic-naming bet);
> drag-to-move a meal between days; cross-store / global calendar.

### Packing lists / collections (OUTPUT) — a check-out / check-in system **[DECIDED]**

Richer than a list: it's a **pick + loan** system that leans on the canvas.

- **Preset, reusable** packing lists (templates reused each trip).
- **Check-out** = items *leave* the store → marked "out / packed"; location flagged.
- **Pick assistance** = while packing, each item shows **where it is** (zone
  highlighted on canvas) so you never hunt.
- **Check-in / put-away** = on return, items restore to inventory and the app
  **suggests the home zone** for each ("Tent → Garage / Camping shelf"), because
  every item remembers its home `blockId`.

Model impact is small: an item gains a transient **state (in place / checked-out)**
on top of its existing home location. The canvas *is* the pick-and-putaway map.

A **collection** = a named set of item references (+ optional desired qty +
checked state), independent of zones, with a `kind`: *packing*, *trade*, *custom*.
Often spans stores → leans **global**. Design the model store-agnostic even if v1
is per-store.

- **Shopping list vs. collection:** shopping list = things to *acquire*;
  collection = a set of things (owned or not) for a *purpose*. A packing list
  *generates* shopping-list entries for gaps — they link, they don't merge.

> ✅ *Done (v1, per-store):* **Collections panel**
> (`components/collections/collectionsPanel.tsx`, store toolbar — desktop +
> mobile, open to all access levels; mutations gated to editors). Tables
> `collections` + `collection_items` (kind `packing`/`trade`/`custom`); items
> gained a `checkedOut` flag. Create collections; add items by **linking an owned
> store item** (autocomplete) or a **free-text** entry. **Pick assistance** —
> each linked item shows its zone; tapping jumps to + highlights it on the map.
> Per-item **packed** ticks; one-tap **Check out / Check in** flags the set + its
> linked items as out (transient loan state) **without decrementing quantity**
> (DECIDED — keeps stock honest and the home `blockId` intact for put-away).
> **Gaps** (unlinked / out-of-stock) add to the shopping list in one tap. Ids
> are client-generated; collection actions live in `store.loader`, each guarded
> to the current store.
> ⬜ *Remaining:* preset/reusable lists; **put-away zone suggestion** on check-in;
> global / cross-store collections (model is already store-agnostic).
> ✅ *Also done:* a visible **"out" badge** for the loan state on item cards, map
> item rows, and the inventory table (not just inside the panel).

### Trade / loan (OUTPUT) — global/social

Items flagged `surplus` (or qty over a "keep" threshold) become eligible for a
trade list → a global Trade surface. Reuses existing public-store/sharing infra.

> ✅ *Done (v1, "the Bazaar"):* global **`/trade` route**
> (`components/trade/tradeBoard.tsx`, `utils/loaders/trade.loader.ts`) — three
> tabs: **Bazaar** (search a card grid of everyone's listings; owner's store
> linked when public), **My listings** (list/unlist any of your items with an
> optional "looking for…" note), **Offers** (incoming accept/decline · outgoing
> cancel). Mechanics borrowed from game/marketplace trade systems:
> **Steam-style offers** (propose with a message + optionally one of your items
> in return); accepting takes the listing off the board and **auto-declines
> competing offers** (first accepted wins). Model: `items.forTrade` +
> `tradeNote`; a `trade_offers` table with denormalised names. Authorized in the
> loader (only the owner lists; only the owner accepts/declines; only the
> requester cancels; no offers on your own listing). Identity shown by **store
> name** — no Clerk user-name lookup; coordination via the public-store link.
> ⬜ *Remaining:* notifications; a reputation/“trades completed” signal; in-app
> messaging or contact exchange on accept; surplus auto-suggestions; a
> contextual "List for trade" from the store item detail.

---

## 8. Onboarding & the make-or-break: adding items

Step 3 (entering existing items) is where home-inventory apps lose people. The
goal of the entire IN/prediction design is **keep data fresh with near-zero manual
effort.**

### Fast-entry playbook (priority order, food-first)

| Technique | What it does | Prior art |
| --- | --- | --- |
| **Receipt scan (OCR)** | snap a grocery receipt → parse line items → bulk add | budgeting apps; biggest groceries accelerator |
| **Barcode batch scan** | scan-scan-scan; autofill name/brand/category from Open Food Facts | Grocy, Sortly |
| **Quick-add tile grid** | tap common items ("Milk, Eggs, Rice") → added w/ smart defaults, no typing | Bring! |
| **Catalog + history autocomplete** | type 2 letters → suggest from catalog + your past items | AnyList |
| **Defer-the-details** | add with just *name + zone*; enrich type/expiry later | progressive disclosure |
| **Smart defaults from context** | Fridge zone → Food + unit + expiry field ready | — |

Rules:
- **Everything optional except name + location.** Capture fast, enrich
  asynchronously. This is how you respect "ASAP without compromising important
  details" — the details arrive, just not as a gate.
- Lead onboarding with **receipt + barcode**, fall back to **quick-add tiles**.

---

## 9. The user flow (and the flywheel)

1. **Start the app.**
2. **Template** — create one or pick a preset and edit (food/kitchen ordered
   first; editing happens on the canvas so the first touch is the hero feature).
3. **Add existing items** — the cost center; minimize friction (see §8).
4. **Use it:** alerts (gentle), recipes (output), packing/loan (output), trade
   (output), shopping list (input). *Outputs generate inputs* — recipe/packing
   gaps draft the shopping list, which refills inventory, which powers outputs.
5. **The app learns & predicts** from inflow + the "out" tap (see §2). Value
   depends on accuracy; accuracy depends on fresh data → every feature must log
   *passively* so the user almost never edits a quantity by hand.
6. **Steady state / the trust loop** — upkeep becomes near-passive; the app shifts
   from *you maintaining it* to *it maintaining you*: gentle nudges, one-tap
   confirmations, and a shared/household + trade layer. The promise lands here: a
   self-updating source of truth for your home that quietly prevents waste and
   "we're out of X."

**Shape of the product:** step 3 is the cost, step 6 is the promise, step 5 is the
bridge. Minimize 3's friction, maximize 5's accuracy.

---

## 10. Design framework references

**Visual / components**
- Apple HIG, Material Design 3 — pattern references (read for principles).
- shadcn/ui (Radix + Tailwind) — modern React component patterns; stack-aligned
  (already on Tailwind v4). Borrow patterns, keep the mono identity.
- *Refactoring UI* (book) — the playbook for making hand-rolled UI look
  intentional; directly serves the "calm, not imposing" goal.

**Domain apps to study**
- **Sortly** — visual home/business inventory (photos, barcode, custom fields,
  low-stock). Closest analog.
- **Grocy** — feature blueprint (barcode consume/purchase, recipes) *and* the
  cautionary tale on manual tracking.
- **Bring!** — best-in-class fast entry (tap tiles, minimal typing).
- **AnyList / Paprika** — recipe ↔ grocery list integration.
- **Tody / Sweepy** — gentle recurring reminders without nagging (tone reference
  for alerts + med doses).

**UX concepts**
- Time-to-value / "aha moment"; progressive disclosure; empty states + starter
  content; the Hooked model (adding items = the "investment" step).

---

## 11. Phased build order **[LEANING]**

1. **Foundation:** item types + traits + type-aware forms; positioning/framing
   reframe (home, food-first). Reframe the predictor to consume inflow + "out".
   - ✅ *Done:* `itemType` column + trait registry (`app/lib/itemTypes.ts`,
     `app/types/itemTypeTypes.ts`); type-aware Add Item form (type selector +
     trait-gated fields + auto-infer from zone/barcode); type-aware edit
     (ItemDetailPopup — Type row + trait-gated rows, never hides existing data).
   - ✅ *Done:* positioning/framing reframe — landing hero/features/steps/
     testimonials (`components/home/`), templates gallery food-first ordering,
     CLAUDE.md "What Locavault is".
   - ✅ *Done (predictor, part 1 — cold start):* type-based priors + Bayesian
     shrinkage + "still learning" (`prior` source) in `usage.helper.ts`; alerts
     gated so a prior guess never raises low-stock (gentle); prior estimates
     rendered muted (`~Nd`) in the table.
   - ✅ *Done (predictor, part 2a — outflow signal):* one-tap **"We're out"** +
     **"Add to list"** in the item detail (`markItemOut` action — zeros qty, logs
     the depletion for calibration, auto-queues a restock on the shopping list).
   - ✅ *Done (predictor, part 2b — inflow cadence):* the estimator now pools two
     signals — outflow (consumption deltas) **and** inflow cadence (the interval
     between restocks, treating the prior purchase as consumed over the gap).
     `getUsageLogsByStore` fetches both-sign logs; `UsageLog` replaces
     `ConsumptionLog`; confidence is driven by pooled rate-sample count.
   - ⬜ *Stretch (predictor):* distributional / survival-with-censoring output
     instead of a point estimate.
   - ⬜ *Later:* surface type as a badge / per-type display in the table & canvas;
     a true one-tap row affordance for "we're out" (currently in the detail popup).
2. **Canvas-primary store page:** informative zone badges, 3-state context panel,
   intent-based overview (retire the flat table), global search.
   - ✅ *Done:* informative **zone status badges** on the canvas — each zone shows
     a count + colour (critical = red / attention = amber) of items needing
     attention, worst-severity wins (`GridCanvas` `blockBadges` prop; computed in
     `store.tsx`; also on the expanded mobile MiniMap). Calm by design: zones with
     everything OK show no badge.
   - ✅ *Done:* **context-aware right pane** — click a zone on the canvas → the
     pane scopes to that zone's contents with a breadcrumb + "All items" back
     (`focusedZoneId`); nothing focused → a **store overview / action queue**
     strip (`StoreOverview`: out/low/expiring counts + one-tap "Add N to list").
     The table is reused, now fed scoped items.
   - ✅ *Done:* **type-aware cards** for zone contents — focusing a zone renders
     its items as cards (`ItemCard`: line-style **`TypeIcon`** SVG glyph, status
     pill, qty, expiry + run-out chips, hover "We're out") instead of the
     spreadsheet. Flat table kept for the cross-zone "All items" view. (No emojis
     anywhere — professional SVGs only.)
   - ✅ *Done:* **clickable overview chips** — the Out/Low/Expiring chips toggle a
     status filter on the all-items list (`statusFilter`); active chip is
     highlighted, click again to clear.
   - ✅ *Done:* **global item search** (`GlobalSearch`, persistent bar under the
     toolbar) — searches all items; selecting a result jumps to its zone
     (`handleJumpToItem` scopes the pane + highlights the canvas). The
     canvas-primary "I don't know where it is" escape hatch.
   - ⬜ *Remaining:* inline item-detail state (currently a popup); cards as an
     option for the all-items view too. (Phase 2 is otherwise complete.)
3. **Purchase capture (the spine):** receipt/barcode/import + quick-add tiles.
4. **Feature surfaces:** Recipes → Collections/packing (check-out/in) → Med
   reminders → Trade.
   - ✅ *Done:* **Recipes** v1 (see §7) — seeded library + fuzzy pantry match +
     "use it up" + one-tap missing-to-list.
   - ✅ *Done:* **Collections / packing** v1 (see §7) — per-store collections,
     link/free-text items, pick assistance, check-out/in (flag, don't
     decrement), gaps → list; loan state surfaced as an "out" badge everywhere.
   - ✅ *Done:* **Trade** v1 — the global Bazaar (see §7): list/unlist, browse,
     Steam-style offers, accept/decline/cancel.
   - ⬜ *Next:* "made this" consumption tap (recipes → prediction loop); put-away
     suggestion on check-in; Med reminders; trade notifications/reputation.

5. **Engineering hygiene (turning the hobby app professional):**
   - ✅ *Done (P0 hardening):* authorization audited & fixed — store mutations
     scoped to their store (no cross-store IDOR), private POs/collections no
     longer leak to viewers/public, action inputs validated/coerced, store
     creation authenticated. **Migration journal baselined** (one baseline +
     `scripts/baseline-mark-applied.mjs`).
   - ✅ *Done (foundation):* ESLint + Prettier, **Vitest** unit tests for the
     prediction/recipe/parse/validate helpers, `.env.example`, a real README,
     and **GitHub Actions CI** (typecheck · lint · format · test · build).
   - ✅ *Done (UX safety net):* removed dead nav links; friendly **error
     boundaries** (shared `ErrorState`, per-route) + a **navigation progress
     bar**; a **toast layer** with `toActionResult` turning expected 4xx into
     `{ ok:false }` so failed optimistic mutations toast + roll back instead of
     failing silently or blanking the page.
   - ✅ *Done (accessibility):* a `useDialog` hook (Escape, focus-into-dialog,
     focus trap, focus restore) applied to the Recipes/Collections/Quick-add/
     item-detail/make-offer dialogs (all now `role="dialog"` + aria-modal +
     labelled); product images carry real alt text.
   - ✅ *Done (chores):* `/api/barcode` hardened (auth + per-user rate limit +
     24h cache, with a tested `rateLimit.helper`); dead imports/props pruned
     (lint warnings 29 → 20).
   - ✅ *Done (map polish):* softened the fixture palette — `shade()` now mixes
     proportionally toward black/white instead of a fixed additive offset, so a
     block's outline/shadow stay in its own hue (a green shelf's outline is a
     deep green, not black) — and redesigned the chunky cabinet/wardrobe/pantry/
     drawers sprites to a cleaner, cohesive style (`app/lib/fixtures.tsx`).
   - ✅ *Done (9-slice fixtures):* storage/counter fixtures now render as ONE
     coherent object at the block's full size (fixed caps + repeating/stretching
     middle) instead of duplicated per-cell tiles — `fill: "slice"`, size-aware
     `SPRITE_BUILDERS(W,H)`, run-length-merged rects. A 1×3 cabinet is one tall
     cabinet; a 4×1 counter is one run. (Toward the Stardew-style top-down look —
     **in-code sprites**, no external tileset.)
   - ✅ *Done (vector fixtures — supersedes the pixel sprites above):* the pixel
     art still read as *duplicated tiles* at larger sizes (backlog #1). Replaced
     the 16×16 pixel engine with **top-down vector** fixtures — `app/lib/
     fixtures.tsx` is now a small typed primitive DSL (`R`/`L`/`C` → rects/lines/
     circles) and one `BUILDERS[id](W,H,tones)` per fixture, recomputed at the
     block's size. Each piece carries its real-world signature (shelf = stocked
     cubbies with *varied* contents, cabinet = recessed door panels + handles,
     bed = pillows + duvet, sofa = backrest + arms + seamed seat, fridge =
     fridge/freezer split, sink = basin + faucet…), so a block reads as ONE
     recognisable object and the repeating parts (shelves, doors, cushions) are a
     *modest, size-keyed* count — never tiled. Crisp at any zoom (no bitmaps).
     `FixtureGraphic` keeps its `{fixture, color, cols, rows}` API, so the editor
     canvas, store map, and block picker pick it up unchanged. Appliances
     (fridge/freezer/stove/sink/washer) switched `single → fit` so they fill the
     footprint you draw; small discrete objects (bin/nightstand/toilet/plant)
     stay `single` (capped + centred so they don't smear in a big block). Colours
     still derive from the block via in-hue `shade()` tones. *Follow-up:* the
     dashboard/gallery thumbnails still draw plain coloured rects — could render
     mini fixtures too, but they may be too small to read.
   - ✅ *Done (categorized picker + room select):* the Add-block modal now leads
     with a category gallery (Storage / Furniture / Appliances / Objects) and a
     **Structural** group (Plain / Room / Divider / Stairs) — stairs & dividers are
     no longer top-level "types" (`category` on `FIXTURE_META`). The store-map room
     selector marks the active room button and rings the focused room (others dim);
     selecting already centres it. The **desk** was redrawn as table-family (inset
     top + corner legs + drawer pedestal).
   - 🟡 *In progress (custom fixtures — freeform builder):* users can draw their
     **own** fixtures and use them like built-ins. A freeform shape editor
     (`CustomFixtureEditor`) — add rect / bar / circle base shapes, drag to move,
     drag the corner to resize, per-shape fill tone, layer, duplicate, delete —
     saves a `customFixtures` row (`{name, category, defaultColor, shapes}`, shapes
     a JSON `CustomShape[]` in a normalised 0–100 box; migration `0003`). Shapes are
     colour-relative (each names a tone resolved from the block colour at render),
     so a custom fixture recolours per block like the built-ins. `block.fixture` is
     now free text — a built-in `FixtureId` **or** a `cf_<id>` (`FixtureRef`); blocks
     resolve `cf_*` through a `CustomFixtureProvider` context (loaded per page). The
     Add-block modal's **Custom** group lists your fixtures + a ＋New tile (editor);
     CRUD via `/api/fixtures` (per-user authorised). Wired into the addstore /
     editstore / templates.new editors and the store map. *Pending:* the `0003`
     migration must be applied to the live Turso DB before it works end-to-end;
     custom fixtures on a template/store shared with another user won't resolve for
     them yet (owner-scoped library).
   - ✅ *Done (wall system):* an edge-based **wall layer** — segments live on the
     grid lines *between* cells, auto-join into runs + corner posts. They're drawn
     and edited from the **Draw** tab, not a separate mode: the draw toolbar carries
     **Wall / Door / Window** tools alongside the block types. With a wall tool
     active, drag = straight axis-locked run (Clash-of-Clans style), drag-from-a-
     matching-segment = erase the run, click = toggle one; drawing one kind over
     another converts it (door = framed opening + threshold, window = glazed pane).
     Persisted as JSON on `stores.walls` (migration `0001_add_walls`), rendered in
     the editor and the store map (slate, thin). Existing dividers untouched.
     (`wall.helper.ts` + tests, `WallLayer`, `GridCanvas` draw branch.)
     **Select** mode handles walls as first-class: click a wall to select just it
     (`edgeAtCell` hit-test), or box-select to grab the walls inside the rectangle;
     selected walls get a thin grey outline matching the block selection ring
     (`WallLayer` glow). A group move carries the selection's walls along by the
     same delta — the selected blocks' bbox ∪ explicitly-selected walls
     (`effectiveWallKeys` → `moveWalls`, offset from an original-walls snapshot, the
     rest stay put; unit-tested). ⌫ deletes selected walls too. Undoable like any
     other edit. Walls also persist through **templates** now (`templates.walls`,
     migration `0002`): the from-scratch builder and save-store-as-template both
     capture the wall layer, and instantiating a store from a template copies it
     back. The old `Door`/`Wall` divider block presets were removed — they're wall
     tools now. Gallery/dashboard **thumbnails** render the wall layer too
     (`GridThumbnail` draws thin bars coloured by kind, in its own SVG space).
     *Follow-ups:* stone/wood floor textures.
   - ✅ *Done (editor UX):* the block-picker modal is now viewport-capped
     (`max-h-[90dvh]`) with a scrollable body so it never overflows off-screen;
     the floor-plan builder supports **undo/redo** (⌘/Ctrl+Z, +Shift or Ctrl+Y —
     coalesced snapshots of blocks+walls, so a drag is one step) and
     **copy/paste** of selected blocks (Ctrl+C/V — pasted offset by one cell with
     fresh ids).
   - ✅ *Done (auth):* the temporary DEV-only Clerk bypass was **removed** —
     `app/lib/auth.ts`'s `getAuth` now delegates straight to Clerk (`userId` is
     `null` when signed out) and `requireAuth` redirects to `/`. Re-verified that
     every loader/action gates on real Clerk auth: `requireAuth` on `/addstore`,
     `/templates`, `/templates/new`, `/trade`; `getAuth` + `verifyStoreAccess`
     (none → redirect, viewer/public filtered) on `/store/:id` and its action;
     owner/editor required for `/store/:id/edit`; owner-only mutations via
     `verifyStoreOwner`/`verifyTemplateOwner`; `/api/barcode` 401s when signed out.
   - ✅ *Done (audit):* a focused typing pass cleared the remaining explicit
     `any`s (lint warnings 20 → 12); **lightweight in-app error monitoring** —
     `app/lib/logger.ts`'s `logError` emits one structured JSON line per real
     failure (5xx / thrown `Error`) to the console, tagged `env: server|client`,
     skipping expected 4xx control-flow throws. Wired into both error boundaries
     (root + per-route); the single sink swaps for an external service later
     without call-site churn.
   - 🟡 *In progress (component dedup):* `CloseButton` (all hand-rolled close-`✕`
     buttons), `EmptyState` (recipes + collections), and `Button` (variant × size
     scale; the primary emerald CTAs migrated) are done and live in
     `components/common/`. **Remaining is not a clean dedup:** the secondary buttons
     are a distinct `uppercase tracking-widest font-bold` pill style spread across
     ~15 controls at inconsistent slate-800/900, text-10/11, rounded-md/lg sizes
     (and several are toggles/tabs, not buttons) — standardising them is a design
     decision, best folded into the polish backlog below. `SidePanel`/`Modal`
     (Phase 3) is deferred pending the panel-presentation rethink (#3 below).

   ### Next iteration — product polish (review 2026-06-19)

   1. ~~**Stretchable fixtures.** Furniture sprites still read as *duplicated*
      tiles at larger sizes, which looks unprofessional.~~ **✅ Done** — replaced
      the pixel sprites with top-down **vector** fixtures (see "Done (vector
      fixtures)" above); each block reads as one recognisable, non-tiled object
      and stays crisp at any zoom.
   2. ~~**Store-map coordinate guides.** The A–J / 1–10 ruler labels are too
      faint and don't line up cleanly.~~ **✅ Done** — darker/semibold/tabular
      labels + faint gutter bands; positions were already cell-aligned
      (`GridRuler`).
   3. **Panel presentation.** ~~The slide-in side panels feel slightly out of
      place.~~ **🟡 In progress** — picked the **tab rail** pattern (the panels
      were side-panels wearing a modal's blocking scrim; the fix is making them
      non-blocking, not switching to modals). A right-edge `PanelRail` toggles the
      side panels, which now keep the map live (no backdrop). Modals stay for true
      atomic tasks (confirms, make-offer). Still to do: shared `SidePanel`
      extraction + non-blocking focus semantics + secondary-button standardisation.
   4. **Recipes.** Let users add their own recipes; then integrate a public-recipe
      source — a recipes API and/or web-scraping — so the library isn't only the
      seeded set.

   ### Task list — status (updated 2026-06-23)

   **✅ Done & verified this session** (typecheck · lint 0-err · 59 tests · build):
   - **Vector fixtures** — all 22 fixtures rewritten as top-down vector art; no
     duplicated-tile look; appliances fill footprint, small objects stay centred
     *(committed `7f0ab81`)*.
   - **Desk redesign** — table-family (inset + corner legs + drawer pedestal)
     *(committed `7f0ab81`)*.
   - **Categorized picker** — Add-block modal grouped Storage / Furniture /
     Appliances / Objects + Structural; stairs/dividers demoted *(committed
     `7f0ab81`)*.
   - **Room select** — focused room ring + dim others + active button on the store
     map *(committed `7f0ab81`)*.
   - **Custom fixture builder (P1)** — freeform shape editor + `customFixtures`
     table/queries + `/api/fixtures` CRUD + `FixtureRef` (`cf_*`) +
     `CustomFixtureProvider` render path + picker "Custom" group; wired into
     addstore / editstore / templates-new / store map *(pending-commit)*.

   **⏳ Pending — immediate (custom fixtures):**
   - [x] **Apply migration `0003` to the live Turso DB** — applied 2026-06-24
         (`custom_fixtures` table now live).
   - [ ] **Verify** the full flow in-app via HMR (create → select → place → render
         on the store map).

   **⏳ Pending — custom fixtures P2/P3:**
   - [ ] **Sharing:** a `cf_*` placed on a store/template shared with another user
         doesn't resolve for them (owner-scoped library). Resolve placed ids for
         viewers, or copy shapes onto shared templates.
   - [ ] **Editor-edit edge case:** an *editor* (non-owner) editing a store that
         uses the *owner's* custom fixtures won't see them in the edit canvas
         (editstore loads only the editing user's library).
   - [ ] **Manage-library UI** (rename/delete outside the picker); optional
         thumbnails rendering custom fixtures.

   **⏳ Pending — original polish backlog:**
   - [x] **#2 Store-map ruler** — bumped label contrast (slate-500, semibold,
         tabular, 10px) + faint gutter bands so the A1/B3 guides read against the
         map background; positions were already cell-aligned (`GridRuler`).
         *(pending your visual confirm via HMR)*
   - [~] **#3 Panel presentation** — chose the **tab rail** pattern. Built a
         right-edge `PanelRail` (Shopping / Recipes / Collections / Members) and
         made the panels **non-blocking**: dropped the `bg-black/40` scrim on
         Recipes & Collections so the map stays live, offset all panels by the
         rail, removed the duplicated desktop-toolbar buttons. *(pending your HMR
         check.)* Follow-ups: a proper shared `SidePanel` extraction + focus
         semantics (aria-modal/trap) for non-blocking; secondary-button
         standardisation.
   - [ ] **#4 Recipes** — add-your-own + public-recipe API / scraping.

---

## 12. Open questions / risks **[OPEN]**

- **Cold start & cadence noise.** Prediction is vague for the first few weeks and
  for erratic items (guests, stockpiling, party shops). Survivable *only* if we
  commit to the gentle/probabilistic presentation; hard numbers would read as
  "wrong." Mitigations to explore: category priors, a one-time "how often do you
  buy this?" nudge, an explicit "still learning" state.
- **Purchase-capture flow** is the next big design topic — it's now the single
  input the whole product balances on (receipt OCR vs. barcode-at-unpack vs.
  accounting-style import; which leads onboarding?).
- Recipe data source (seed vs. API; licensing/cost).
- ~~Collections: per-store v1 vs. global from the start.~~ **Resolved:** shipped
  **per-store v1** with a store-agnostic model, so promoting to global/cross-store
  later is a small step.
- Whether the "out / low" tap and shopping-list "add" should be the same gesture.

---

*Last updated during design ideation. Continue from §12.*
