import type { ActionFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { parseRecipeFromJsonLd } from "~/utils/helpers/recipeImport.helper";
import { checkUrl } from "~/utils/helpers/ssrfGuard.helper";
import { createRateLimiter } from "~/utils/helpers/rateLimit.helper";

/**
 * Import a recipe from a URL (resource route, no UI). POST `{ url }`; we fetch the
 * page server-side, pull its schema.org/Recipe JSON-LD, and return a normalised
 * draft for the editor to confirm. No API key — license-clean structured data.
 *
 * SSRF guard (`ssrfGuard.helper`): http(s) only, no userinfo, and every host is
 * DNS-resolved and rejected if any resolved address is private/loopback/
 * link-local — so numeric-host encodings and IPv4-mapped IPv6 can't slip past.
 * Each redirect hop is re-validated. Plus a per-user rate limit (this route makes
 * authed outbound fetches), an 8s timeout, and a read cap. Residual DNS-rebinding
 * TOCTOU is documented in the guard and accepted for a self-service importer.
 */

const FETCH_TIMEOUT_MS = 8000;
const READ_CAP_CHARS = 2_000_000;
const MAX_REDIRECTS = 4;

// Per-process limiter (see rateLimit.helper for the scaling caveat). Stricter
// than barcode: each call is an outbound fetch, so keep the ceiling low.
const limiter = createRateLimiter({ max: 20, windowMs: 60_000 });

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();
  const decoder = new TextDecoder();
  let html = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) html += decoder.decode(value, { stream: true });
    if (html.length >= READ_CAP_CHARS) {
      await reader.cancel();
      break;
    }
  }
  return html;
}

type FetchResult = { html: string; finalUrl: string } | { error: string };

async function fetchHtml(start: URL): Promise<FetchResult> {
  let url = start;
  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url.href, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          // A real browser UA — some blogs 403 obvious bots. (Big commercial
          // sites with edge bot-mitigation will still block; use search there.)
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.9",
        },
      });
    } catch {
      clearTimeout(timer);
      return { error: "fetch_failed" };
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { error: "fetch_failed" };
      let next: URL;
      try {
        next = new URL(loc, url);
      } catch {
        return { error: "fetch_failed" };
      }
      const validated = await checkUrl(next.href);
      if (!validated.ok) return { error: "blocked" };
      url = validated.url;
      continue;
    }

    if (!res.ok) return { error: "fetch_failed" };
    const html = await readCapped(res);
    return { html, finalUrl: url.href };
  }
  return { error: "too_many_redirects" };
}

export async function action(args: ActionFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  if (!limiter.take(userId))
    return Response.json({ error: "rate_limited" }, { status: 429 });

  const body = (await args.request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const guard = await checkUrl(String(body.url ?? "").trim());
  if (!guard.ok)
    return Response.json(
      { error: guard.reason },
      { status: guard.reason === "invalid_url" ? 400 : 422 },
    );

  const result = await fetchHtml(guard.url);
  if ("error" in result)
    return Response.json({ error: result.error }, { status: 422 });

  const parsed = parseRecipeFromJsonLd(result.html);
  if (!parsed) return Response.json({ error: "no_recipe" }, { status: 422 });

  return Response.json({ recipe: { ...parsed, sourceUrl: result.finalUrl } });
}
