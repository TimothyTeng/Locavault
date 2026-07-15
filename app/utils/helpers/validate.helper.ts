// Server-side input coercion/validation for action payloads. The client sends
// reasonable data, but actions must never trust it: reject empty required
// fields, and coerce numbers/dates so a NaN or "Invalid Date" can never reach
// the DB. Keep these permissive (clamp, don't 400) for optional fields, strict
// (throw 400) only for genuinely required ones.

import type { BlockKind } from "~/types/BlockTypes";
import type { BlockDetails } from "~/types/storeViewFinderTypes";

/** Throw a 400 with a user-facing message. */
export function badRequest(message: string): never {
  throw new Response(message, { status: 400 });
}

/** Required trimmed string (1..maxLen chars), else 400. */
export function requireText(v: unknown, field = "value", maxLen = 500): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) badRequest(`${field} is required`);
  return s.slice(0, maxLen);
}

/** Optional string → trimmed non-empty string or null (never undefined/NaN). */
export function optText(v: unknown, maxLen = 2000): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, maxLen) : null;
}

/** Finite integer clamped to [min,max], or null for optional numeric fields. */
export function optInt(
  v: unknown,
  { min = 0, max = 1_000_000_000 }: { min?: number; max?: number } = {},
): number | null {
  if (v == null || v === "") return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, min), max);
}

/** Quantity-style integer clamped to [min,max], falling back when unparseable. */
export function toQty(
  v: unknown,
  fallback = 1,
  { min = 0, max = 1_000_000 }: { min?: number; max?: number } = {},
): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** Valid Date or null — rejects Invalid Date so NaN epochs never get stored. */
export function optDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string | number | Date);
  return isNaN(d.getTime()) ? null : d;
}

/** One of the allowed enum values, else the fallback. */
export function oneOf<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

// ── Block payloads ─────────────────────────────────────────
// Floor-plan blocks come straight from the client editor. `createStoreWithBlocks`
// / `updateStoreWithBlocks` write x/y/w/h into grid math and bg/border into inline
// styles, so clamp geometry, allow-list `kind`, and reject non-hex colours before
// they reach the DB. `block_id` is preserved verbatim when present — the update
// path diffs it to detect removed blocks (a changed id would orphan its items).

const BLOCK_KINDS: readonly BlockKind[] = [
  "standard",
  "divider",
  "stairs",
  "room",
];
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const FIXTURE_REF = /^[a-zA-Z0-9_-]{1,64}$/;

function hexColor(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX_COLOR.test(v) ? v : fallback;
}

function clampInt(v: unknown, fallback: number, min: number, max: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/**
 * Coerce a client blocks array into a bounded, sanitised `BlockDetails[]`:
 * caps the count, clamps coordinates/sizes, allow-lists `kind`, and forces
 * colours to hex. Non-array input → `[]`.
 */
export function validateBlocks(
  v: unknown,
  {
    maxCount = 2000,
    maxCoord = 500,
  }: { maxCount?: number; maxCoord?: number } = {},
): BlockDetails[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, maxCount).map((b): BlockDetails => {
    const raw = (b ?? {}) as Record<string, unknown>;
    const fixture =
      typeof raw.fixture === "string" && FIXTURE_REF.test(raw.fixture)
        ? (raw.fixture as BlockDetails["fixture"])
        : null;
    return {
      block_id:
        typeof raw.block_id === "string" && raw.block_id
          ? raw.block_id.slice(0, 64)
          : crypto.randomUUID(),
      background: hexColor(raw.background, "#000000"),
      border: hexColor(raw.border, "#000000"),
      label: typeof raw.label === "string" ? raw.label.slice(0, 120) : "",
      x: clampInt(raw.x, 0, 0, maxCoord),
      y: clampInt(raw.y, 0, 0, maxCoord),
      width: clampInt(raw.width, 1, 1, maxCoord),
      height: clampInt(raw.height, 1, 1, maxCoord),
      kind: oneOf(raw.kind, BLOCK_KINDS, "standard"),
      fixture,
    };
  });
}
