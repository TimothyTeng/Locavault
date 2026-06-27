import type { ActionFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { mealsToResults } from "~/utils/helpers/mealdb.helper";

/**
 * Search public recipes (resource route, no UI). POST `{ q }`; we query TheMealDB
 * — a free, no-key public recipe API — and return normalised results the editor
 * can pre-fill from directly (search.php returns full meals, so no second call).
 *
 * `MEALDB_API_KEY` (default "1", the public test key) is read from the env so a
 * premium key can be slotted in later without code changes. Single trusted host,
 * so no SSRF guard is needed.
 */

const FETCH_TIMEOUT_MS = 8000;
const MAX_RESULTS = 25;

export async function action(args: ActionFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await args.request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const q = String(body.q ?? "").trim();
  if (!q) return Response.json({ results: [] });

  const key = process.env.MEALDB_API_KEY || "1";
  const url = `https://www.themealdb.com/api/json/v1/${key}/search.php?s=${encodeURIComponent(
    q,
  )}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok)
      return Response.json({ error: "search_failed" }, { status: 502 });
    const data = (await res.json()) as { meals: unknown };
    const results = mealsToResults(
      Array.isArray(data.meals)
        ? (data.meals as Record<string, string | null>[])
        : null,
    ).slice(0, MAX_RESULTS);
    return Response.json({ results });
  } catch {
    return Response.json({ error: "search_failed" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
