# Security

Locavault is a home-inventory web app (React Router v7 SSR · Clerk · Turso/Drizzle).
This document is the standing security process — how findings are handled, what gets
checked on a cadence, and the bar every new change clears.

## Reporting a vulnerability

Email the maintainer (see the repo owner's profile) with a description and, if
possible, a proof of concept. Please do not open a public issue for an
unpatched vulnerability.

## Architecture guarantees (keep these true)

- **Authorize in the loader/action, never the client.** Every store-scoped
  mutation goes through `verifyStoreAccess` (owner/editor/viewer/public/none), and
  every client-supplied row id is re-checked to belong to the acting store
  (`ensureItemInStore` / `ensureBlockInStore` / `ensurePOInStore` /
  `ensureCollectionInStore` in `store.loader.ts`). No IDOR by trusting an id.
- **All DB access lives in `app/lib/queries.tsx`** and uses the Drizzle query
  builder / parameterized `sql`` — never string-concatenated SQL.
- **Coerce and allow-list untrusted input** with `app/utils/helpers/validate.helper.ts`
  (`requireText` / `optInt` / `toQty` / `optDate` / `oneOf` / `validateBlocks`)
  before it reaches the DB. Enums (`itemType`, `useRatePeriod`, block `kind`, …)
  are `oneOf`-gated.
- **Outbound fetches are guarded.** URL imports run through
  `ssrfGuard.helper.ts` (DNS-resolved, private/reserved IPs rejected). Resource
  routes that fetch or write are per-user rate-limited (`rateLimit.helper.ts`).
- **URLs rendered as `href`/`src` pass `url.helper.ts#safeUrl`** (http/https only)
  at both write time and render time.
- **Public/viewer responses are projected** (`publicShape.helper.ts`) so owner
  identity and item economics (cost/sku/reorder data) never leak to non-owners.
- **Security headers** are set in `app/entry.server.tsx`
  (`securityHeaders.helper.ts`). CSP currently ships **Report-Only** — see below.

## Automated scanning

- **Dependabot** (`.github/dependabot.yml`) — weekly npm + Actions bumps.
- **CodeQL** (`.github/workflows/codeql.yml`) — push/PR/weekly, `security-and-quality`.
- **`npm audit`** — non-blocking CI job (`ci.yml`). Promote to a hard gate once
  it's been clean for a sustained period.
- Enable GitHub **secret scanning + push protection** in repo settings.

## Open follow-ups

- **Promote CSP from Report-Only to enforcing** once violation reports are clean
  against the live Clerk origins (can't be exercised in the local sandbox).
- Rate limiter is **in-memory / per-process** — fine for a single instance; needs
  a shared store (e.g. Redis) before horizontal scaling.
- SSRF guard has a residual DNS-rebinding TOCTOU (resolve → connect gap),
  documented as accepted for a signed-in self-service importer.

## Quarterly review checklist

- [ ] Every action added since last review has an authz guard **and**
      `oneOf`/`validate` coverage on its inputs.
- [ ] Every public/viewer-facing loader return is audited against the
      `publicShape` projections (no new field leaks owner id / economics).
- [ ] Rate-limit registry below is complete — every `app/routes/api.*` route and
      every abuse-prone loader action appears with its limit.
- [ ] `curl -sI https://<prod>` shows the expected security headers; CSP still
      matches Clerk's current origins.
- [ ] `npm audit` triaged; Dependabot PRs merged or dismissed with reason.
- [ ] Clerk + Turso dashboards reviewed (keys rotated if needed, no stray access).

### Rate-limit registry

| Surface | Limit (per user) |
| --- | --- |
| `api.barcode` | 60 / min |
| `api.recipe-import` | 20 / min (outbound fetch + SSRF surface) |
| `api.recipe-search` | 30 / min (outbound fetch) |
| `api.recipes` | 60 / min |
| `api.fixtures` | 60 / min |
| `store.loader` — `createInvite` | 20 / min |
| `trade.loader` — `makeOffer` | 30 / min |

## Threat-model note (required in every schema-bearing PR)

Answer these four in the PR description while the context is fresh:

1. **New inputs?** What client-controlled fields are added — are they validated/allow-listed?
2. **New public surface?** Does any new data reach viewers/public/other users — is it projected?
3. **New outbound fetch?** Does it go through the SSRF guard + a rate limit?
4. **New PII stored?** What identifies a person, and is it scoped to its owner?
