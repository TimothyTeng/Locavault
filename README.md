# Locavault

**Home inventory, food-first.** Know what you're running out of before you do,
find anything in seconds, and cook from what you keep — without logging your life.

You create **stores** (a pantry, a kitchen, a garage), draw a **floor plan** out
of positioned **blocks** (shelves, fridges, zones), and track **items** placed in
those blocks. Locavault learns your restock cadence to predict run-out, suggests
**recipes** from what's in stock, helps you **pack** for trips (check-out /
check-in), and lets you trade surplus on a global **Bazaar**. The engine is
category-agnostic — food is the flagship use case, not a hard limit.

See [`DESIGN.md`](./DESIGN.md) for product direction and
[`CLAUDE.md`](./CLAUDE.md) for an architecture/onboarding guide.

## Tech stack

- **React Router v7** (framework mode, SSR) · **React 19** · TypeScript (strict)
- **Vite 7** + **Tailwind CSS v4**
- **Clerk** for auth · **Turso / libSQL** + **Drizzle ORM** for data
- **Vitest** for tests · **ESLint** + **Prettier** · GitHub Actions CI

## Getting started

### 1. Prerequisites

- Node 20+ and npm
- A [Clerk](https://clerk.com) application (publishable + secret keys)
- A [Turso](https://turso.tech) database (URL + auth token)

### 2. Install & configure

```bash
npm install
cp .env.example .env   # then fill in your Clerk + Turso values
```

### 3. Set up the database

The schema lives in [`app/lib/schema.ts`](./app/lib/schema.ts) and migrations are
baselined, so a fresh database is one command:

```bash
npx drizzle-kit migrate   # builds all tables from drizzle/0000_baseline.sql
```

(If you point at a DB that already has the tables, run
`node --env-file=.env scripts/baseline-mark-applied.mjs` once first — see the
migrations note in [`CLAUDE.md`](./CLAUDE.md).)

### 4. Run

```bash
npm run dev   # http://localhost:5173
```

> Auth note: Clerk's dev instance redirects sign-in to a hosted
> `*.clerk.accounts.dev` domain. Use a real browser at `http://localhost:5173`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (Vite + HMR) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | React Router typegen + `tsc` |
| `npm run lint` | ESLint |
| `npm run format` / `format:check` | Prettier write / check |
| `npm test` / `test:watch` | Vitest |
| `npx drizzle-kit generate` / `migrate` | Generate / apply a migration |

## Project structure

```
app/
├── root.tsx            # Clerk provider + app shell
├── routes.ts           # route table
├── routes/             # thin routes — re-export loader/action from utils/loaders
├── lib/                # db, schema (source of truth), queries, auth
├── utils/loaders/      # the real server logic (loaders + actions)
├── utils/helpers/      # pure helpers (+ their *.test.ts)
├── components/         # UI by feature (store, addItem, recipes, trade, …)
└── types/              # shared TS types
```

Conventions: all DB access goes through `app/lib/queries.tsx`; money is stored in
cents; mutations authorize in the loader/action (never trust the client). Details
in [`CLAUDE.md`](./CLAUDE.md).

## Deployment

`npm run build` produces `build/client` (static assets) and `build/server`
(SSR server). Serve with `npm run start`, or deploy the build to any Node host.
Set the same four env vars from `.env.example` in your hosting environment.
