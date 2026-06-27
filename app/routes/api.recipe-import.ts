import type { ActionFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { parseRecipeFromJsonLd } from "~/utils/helpers/recipeImport.helper";

/**
 * Import a recipe from a URL (resource route, no UI). POST `{ url }`; we fetch the
 * page server-side, pull its schema.org/Recipe JSON-LD, and return a normalised
 * draft for the editor to confirm. No API key — license-clean structured data.
 *
 * SSRF guard: http(s) only, blocked private/loopback/link-local hosts, manual
 * redirect following (each hop re-validated), an 8s timeout, and a read cap. The
 * host check is by hostname pattern (best-effort) — it does not resolve DNS, so a
 * public name pointing at a private IP is not caught; acceptable for a signed-in
 * user importing their own recipe.
 */

const FETCH_TIMEOUT_MS = 8000;
const READ_CAP_CHARS = 2_000_000;
const MAX_REDIRECTS = 4;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local"))
    return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

function validateUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (isBlockedHost(u.hostname)) return null;
  return u;
}

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
      let next: URL | null;
      try {
        next = new URL(loc, url);
      } catch {
        return { error: "fetch_failed" };
      }
      const validated = validateUrl(next.href);
      if (!validated) return { error: "blocked" };
      url = validated;
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

  const body = (await args.request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const url = validateUrl(String(body.url ?? "").trim());
  if (!url) return Response.json({ error: "invalid_url" }, { status: 400 });

  const result = await fetchHtml(url);
  if ("error" in result)
    return Response.json({ error: result.error }, { status: 422 });

  const parsed = parseRecipeFromJsonLd(result.html);
  if (!parsed) return Response.json({ error: "no_recipe" }, { status: 422 });

  return Response.json({ recipe: { ...parsed, sourceUrl: result.finalUrl } });
}
