// Shared URL sanitiser. Used at BOTH write time (recipe CRUD/import) and render
// time (recipe image/source links) so a `javascript:`/`data:`/other-scheme URL
// can never end up in an `href` or `src` — even for rows written before the
// write-time guard existed, or via any future path that bypasses it.

/** Return the URL only if it's a plausible http(s) URL, else null. */
export function safeUrl(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? s : null;
  } catch {
    return null;
  }
}
