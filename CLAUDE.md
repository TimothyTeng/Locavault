# CLAUDE.md

Guidance for working in the **Locavault** codebase.

## What Locavault is

Locavault is a **home inventory** web app, **food-first** (see `DESIGN.md` for the
full product direction). The promise: *know what you're running out of before you
do, find anything in seconds, and restock without logging your life.* It stays
broad (the engine is category-agnostic) — food is the flagship use case and
onboarding hook, not a hard scope limit.

Mechanically: a user creates **stores** (physical locations — a pantry, a kitchen,
a garage), draws a **floor plan** of that store out of positioned **blocks**
(shelves, zones, dividers, stairs), and tracks **items** placed in those blocks.
Stores can be shared with collaborators, made public (read-only), and items can be
restocked via a **shopping-list / purchase-order** workflow that also predicts when
stock will run out.

## Tech stack

| Concern        | Choice |
| -------------- | ------ |
| Framework      | **React Router v7** (framework mode, SSR enabled — `react-router.config.ts`) |
| Build / dev    | **Vite 7** + `@react-router/dev`, `@tailwindcss/vite`, `vite-tsconfig-paths` |
| Language        | TypeScript (strict), React 19 |
| Styling        | **Tailwind CSS v4** (imported in `app/app.css`). UI uses a `font-mono` aesthetic |
| Auth           | **Clerk** (`@clerk/react-router`) — middleware + `rootAuthLoader` in `app/root.tsx` |
| Database       | **Turso / libSQL** via **Drizzle ORM** (`drizzle-orm/libsql`) |
| Migrations     | **drizzle-kit** (dialect `turso`), output in `./drizzle` |
| Animation      | GSAP + ScrollTrigger (marketing/landing page only) |
| Grid editor    | `react-grid-layout` (floor-plan canvas) |

## Commands

```bash
npm run dev        # react-router dev server (Vite) — http://localhost:5173
npm run build      # production build
npm run start      # serve the production build (build/server/index.js)
npm run typecheck  # react-router typegen && tsc
npm run lint       # eslint (flat config; 0 errors expected, some warnings)
npm run format     # prettier --write .   (format:check to verify)
npm test           # vitest run  (unit tests for pure helpers)

npx drizzle-kit generate   # generate a migration from schema.ts
npx drizzle-kit migrate    # apply migrations to Turso
```

> CI (`.github/workflows/ci.yml`) runs typecheck · lint · format:check · test ·
> build on every push to `main` and PR. Keep them green. Tests live next to the
> helper they cover (`app/utils/helpers/*.test.ts`); add tests for new pure logic.

> **Migrations are baselined.** The journal was squashed to a single baseline
> (`drizzle/0000_baseline.sql`) that mirrors `schema.ts`, so the normal flow now
> works: edit `schema.ts` → `npx drizzle-kit generate` → `npx drizzle-kit
> migrate`. `schema.ts` is still the runtime source of truth.
>
> - **Fresh/empty DB:** just `npx drizzle-kit migrate` (runs the baseline, builds
>   all tables).
> - **An already-populated DB** (e.g. the current live Turso DB, which predates
>   the baseline): run `node --env-file=.env scripts/baseline-mark-applied.mjs`
>   **once** to record the baseline as applied in `__drizzle_migrations`, so
>   `migrate` is a no-op instead of trying to recreate existing tables. The live
>   DB has already been marked.
> - The older one-off `scripts/add-*.mjs` ALTER scripts are historical (kept for
>   reference); prefer `generate`/`migrate` going forward.

> **Preview caveat:** the embedded Claude preview only allows `localhost` URLs.
> Clerk's dev instance redirects sign-in to a hosted `*.clerk.accounts.dev`
> domain, which the sandbox blocks — so the in-editor preview shows a blank page.
> Open `http://localhost:5173` in a real browser to exercise auth.

## Environment variables

Required in `.env` (not committed):

- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk frontend key (exposed to the client via Vite)
- `CLERK_SECRET_KEY` — Clerk backend key
- `TURSO_DATABASE_URL` — libSQL connection URL
- `TURSO_AUTH_TOKEN` — Turso auth token

## Project layout

```
app/
├── root.tsx              # ClerkProvider + clerkMiddleware + rootAuthLoader; <Layout> shell
├── routes.ts             # route table (see Routes below)
├── app.css               # Tailwind entry
├── routes/               # one file per route — thin; re-export loader/action from utils/loaders
│   ├── home.tsx          #   "/"  landing page (signed-out) OR dashboard (signed-in)
│   ├── addstore.tsx      #   "/addstore"  floor-plan builder for a new store
│   ├── store.tsx         #   "/store/:id"  the main store view (canvas + inventory)
│   ├── editstore.tsx     #   "/store/:id/edit"  edit floor plan + metadata
│   └── invite.tsx        #   "/invite/:token"  claim a collaboration invite
├── lib/
│   ├── db.ts             # Drizzle client (Turso)
│   ├── schema.ts         # ALL Drizzle tables + relations (source of truth)
│   ├── queries.tsx       # ALL DB access functions — import these, don't query inline
│   └── auth.ts           # requireAuth() helper (redirects to "/" if signed out)
├── utils/
│   ├── loaders/          # loader + action for each route (the real server logic)
│   ├── helpers/          # pure helpers (grid math, block↔map conversion, table sort)
│   ├── useIsMobile.tsx   # responsive hook
│   ├── useZoom.ts        # canvas zoom hook
│   └── GridHelper.tsx
├── components/
│   ├── home/             # landing page sections + dashboard (storecard, thumbnail…)
│   ├── addstore/         # floor-plan editor: storeViewFinder/, blockPicker/
│   ├── store/            # store view: table, rows, header, toolbar, minimap, members, filters
│   ├── addItem/          # add-item slide-in panel + form + barcode scanner + quick (bulk) add
│   ├── purchases/        # shopping-list panel, list, rows, suggestions, optional fields
│   ├── recipes/          # recipes panel: seeded library matched against pantry (see DESIGN.md §7)
│   ├── collections/      # collections / packing panel: group items, pick assist, check-out/in (DESIGN.md §7)
│   ├── trade/            # the Bazaar: global trade board + offers (DESIGN.md §7)
│   └── templates/        # templates gallery + card + save-from-store modal
└── types/                # shared TS types (one file per domain)
```

## Routing & data flow

Routes are intentionally **thin**. Each `app/routes/*.tsx` file re-exports its
`loader`/`action` from `app/utils/loaders/<name>.loader.ts`:

```ts
export { loader, action } from "#utils/loaders/store.loader";
```

- **Loaders** authenticate with Clerk's `getAuth(args)`, authorize via
  `verifyStoreAccess` / `requireAuth`, then fetch through `lib/queries`.
- **Actions** take a single JSON body with an `_action` discriminator
  (e.g. `"createItem"`, `"updatePOItem"`, `"buyPOItem"`) and branch on it. All
  mutations on the store page go through `store.loader.ts`'s action.
- The client submits via `useFetcher` with `encType: "application/json"` and
  applies **optimistic updates** (an `optimisticId` is sent, then reconciled to
  the real DB id when the action returns).

### Routes

| Path | File | Notes |
| ---- | ---- | ----- |
| `/` | `home.tsx` | `<Show when="signed-out">` → marketing page; `signed-in` → `<Dashboard>`. Loader returns the user's stores (owned + member-of). |
| `/addstore` | `addstore.tsx` | Signed-in only. Floor-plan builder; action calls `createStoreWithBlocks`. |
| `/store/:id` | `store.tsx` | Main view. Loader resolves `accessLevel`; filters items by visibility for `public`/`viewer`. Polls every 15s via `useRevalidator`. |
| `/store/:id/edit` | `editstore.tsx` | `owner`/`editor` only. Replaces all blocks atomically via `updateStoreWithBlocks`. |
| `/invite/:token` | `invite.tsx` | Claims an invite then redirects to the store; prompts sign-in if needed. |
| `/templates` | `templates.tsx` | Signed-in gallery of layout templates (public + your own private). Action handles `useTemplate` (→ new store), `createFromStore`, `setVisibility`, `deleteTemplate`. |
| `/templates/new` | `templates.new.tsx` | From-scratch template builder; reuses `StoreViewFinder` via its `onSave` prop. Creates a **private** template (toggle public in the gallery). |
| `/trade` | `trade.tsx` | Signed-in **global Bazaar** (DESIGN.md §7): browse all `forTrade` listings, list/unlist your own, and make/accept/decline/cancel trade offers. Action authorizes per-offer (owner vs requester). |
| `/api/barcode` | `api.barcode.ts` | Resource route (no UI). `GET ?code=` → Open Food Facts product lookup for barcode scanning. |

## Data model (`app/lib/schema.ts`)

All ids are `text` UUIDs (`crypto.randomUUID()`). Timestamps are `integer` epoch
(`mode: "timestamp"`). Booleans are `integer` (`mode: "boolean"`).

- **stores** — name, tags (JSON string array), description, `rows`/`cols` (grid
  size), `userId` (owner, Clerk id), `isPublic`, `canvasVisible`.
- **blocks** — a rectangle on the store grid: `x`/`y`/`width`/`height`, colors,
  `label`, and `kind` ∈ `{standard, divider, stairs}`. FK → store (cascade delete).
- **items** — `name`, `quantity`, `blockId` (nullable → `set null` if block removed),
  `isPublic`, `itemType` ∈ `{food, medication, supplies, equipment, clothing,
  document, other}` (default `other`), plus inventory fields: `sku`, `unit`,
  `minQuantity`, `cost` (**cents**), `expiryDate`, `useRate` + `useRatePeriod` ∈
  `{day, week, month}`. `itemType` maps to **traits** (`app/lib/itemTypes.ts`)
  that drive which form fields/behaviours apply — see `DESIGN.md` §5.
- **itemLogs** — append-only quantity changes: `delta` (negative = consumed,
  positive = restocked), `note`, `loggedBy`. Used by `predictRunoutDays`.
- **storeMembers** — `(storeId, userId, role)` with role ∈ `{owner, editor, viewer}`.
  The owner is auto-inserted as a member on store creation.
- **storeInvites** — shareable `token`, role `editor` only, 7-day expiry,
  `claimedAt`. `createInvite` reuses an existing unclaimed/unexpired invite.
- **purchaseOrderItems** — a shopping list / restock queue. Mirrors the item field
  set, with optional `itemId` linking to an existing item. "Buying" a PO row adds
  quantity to the linked item (or creates a new item) then deletes the PO row.
- **templates** — a reusable, shareable store **layout** (blocks only, no items):
  name, description, tags, `rows`/`cols`, `userId` (creator), `isPublic`,
  `usageCount`. Any signed-in user can create templates; public ones are visible
  to everyone. `createStoreFromTemplate` instantiates a store (copies blocks with
  fresh ids, adds the owner member, bumps `usageCount`).
- **templateBlocks** — mirrors `blocks`, FK → template (cascade delete).
- **collections** — a named set of item references for a *purpose* (DESIGN.md §7),
  distinct from the shopping list: name, description, `kind` ∈ `{packing, trade,
  custom}`, `checkedOut` (the set is taken out), `userId`, FK → store (cascade).
  Per-store v1 but the model is store-agnostic for a future global layer.
- **collectionItems** — a row in a collection: `name` (denormalised), `desiredQty`,
  `checked` ("packed" tick), optional `itemId` linking an owned item (`set null`;
  null = a free-text gap). FK → collection (cascade delete).
- **items.checkedOut** — transient "packed/out" loan state, set while the item is
  in a checked-out collection. Does **not** decrement quantity; cleared on check-in.
- **items.forTrade / tradeNote** — owner-opted onto the global Bazaar (DESIGN.md §7),
  with an optional "looking for…" wants note (cleared on unlist).
- **tradeOffers** — a Steam-style offer on a listing: `listingItemId` (requested),
  optional `offeredItemId` (offered in return), `fromUserId`/`toUserId`, `message`,
  `status` ∈ `{pending, accepted, declined, cancelled}`. Item names are
  denormalised so an offer still reads after an item is deleted/unlisted.
  Accepting unlists the item and auto-declines competing pending offers.

Relations are declared at the bottom of `schema.ts`. FKs cascade on store delete;
item/block references on PO and collection rows use `set null`.

## Access control

`AccessLevel = "owner" | "editor" | "viewer" | "public" | "none"`
(`app/types/memberTypes.ts`). `verifyStoreAccess(storeId, userId)` returns the
store + level in one fetch:

- **owner** — full control; only owners see the members panel.
- **editor** — can add/edit items, edit the floor plan; cannot manage members.
- **viewer** — read-only; sees only `isPublic` items.
- **public** — unauthenticated visitor to an `isPublic` store; sees public items,
  and the canvas only if `canvasVisible`.
- **none** — no access; loader redirects to `/`.

`canEdit = owner || editor`. Always authorize in the loader/action — never trust
the client.

## Conventions

- **Path aliases** (`tsconfig.json`): `~/*` → `app/*`, plus `#types/*`,
  `#components/*`, `#lib/*`, `#utils/*`, `#routes/*`. Both `~/` and `#` forms appear
  in the codebase; prefer matching the surrounding file.
- **All DB access lives in `app/lib/queries.tsx`** — add a function there rather
  than querying Drizzle from a loader/component.
- **Money is stored in cents** (`items.cost`, `purchaseOrderItems.cost`).
- **Optimistic UI**: client mutations generate a temp `optimisticId`, push to local
  state immediately, and reconcile against the action's returned real id.
- **Mobile**: `useIsMobile()` drives layout switches (e.g. the canvas becomes a
  floating `MiniMap` on mobile, full split-pane on desktop).
- Schema changes: edit `schema.ts`, then `npx drizzle-kit generate` + `migrate`.
- The landing page (`components/home/*`) is marketing-only and GSAP-animated;
  it renders for signed-out users. The dashboard renders for signed-in users.
