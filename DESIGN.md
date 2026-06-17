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
> missing), each with a ring gauge. **Use it up** leads — recipes consuming items
> expiring ≤30d get an amber banner + a top-of-panel nudge. One tap adds the
> lacking ingredients to the shopping list (skips already-queued; cards show
> what's listed) via the existing `createPOItems` action.
> ⬜ *Remaining:* user-saved recipes; a recipe API for volume; a **"made this"**
> tap that decrements matched items (closes the recipes → consumption →
> prediction loop).

Design rules learned from the critique:
- **Volume comes from a seeded library and/or a recipe API** (Spoonacular /
  Edamam / Samsung Food-style) + user saves — *never* depend on the user authoring
  enough recipes.
- **Match against "what you typically keep" (purchase profile), not exact
  counts.** Your buying history *is* your pantry. Avoid Grocy-style exact-quantity
  matching (it needs precise tracking we don't have); make it an in-the-moment
  manual opt-in if ever wanted.
- The **"use it up"** mode (recipes that use items expiring soon) is the emotional
  core of food-first — it actively prevents waste.

The reinforcing loop: track food → expiry/run-out signals → recipes suggest using
expiring items → cooking optionally logs consumption → better prediction → smarter
shopping list.

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
   - ⬜ *Next (from the audit):* dead-link cleanup (`/purchases`, `/settings`) +
     error/loading/empty states + a toast layer for failed mutations; then a
     shared panel/modal/button component pass and accessibility (focus trap,
     Escape, alt text); rate-limit `/api/barcode`; error monitoring.

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
