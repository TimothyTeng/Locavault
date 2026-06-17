// Server-side input coercion/validation for action payloads. The client sends
// reasonable data, but actions must never trust it: reject empty required
// fields, and coerce numbers/dates so a NaN or "Invalid Date" can never reach
// the DB. Keep these permissive (clamp, don't 400) for optional fields, strict
// (throw 400) only for genuinely required ones.

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
