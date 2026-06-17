/**
 * Convert a thrown client-error Response (4xx) from an action into a returned
 * `{ ok: false, error }` value, so the client can show a toast and roll back
 * optimistic state instead of the whole route blanking via its ErrorBoundary.
 * Server errors (5xx) and non-Response throws still propagate to the boundary —
 * those are genuine "something is broken" cases worth a full error screen.
 */
export async function toActionResult<T>(
  run: Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await run;
  } catch (e) {
    if (e instanceof Response && e.status >= 400 && e.status < 500) {
      const error = await e
        .clone()
        .text()
        .catch(() => "");
      return { ok: false, error: error || "Request failed" };
    }
    throw e;
  }
}
