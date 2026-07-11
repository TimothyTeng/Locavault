import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import {
  createRateLimiter,
  createTtlCache,
} from "~/utils/helpers/rateLimit.helper";

/**
 * Barcode → product info lookup (resource route, no UI).
 *
 * GET /api/barcode?code=<gtin>
 *
 * Uses Open Food Facts (free, no API key, global — covers 888-prefixed SG food).
 * Runs server-side so we control the User-Agent, map categories, and avoid CORS.
 * NOTE: this only resolves the *product identity* (name/brand/size). Expiry is
 * never in a retail barcode DB — that comes from the GS1 (17) field or the user.
 *
 * Hardened: requires sign-in (the scanner is an authed, edit-only feature), is
 * rate-limited per user, and caches lookups so repeated scans don't re-hit OFF.
 */

type BarcodeResult =
  | { found: false }
  | {
      found: true;
      name: string;
      brand: string | null;
      unit: string | null;
      /** OFF's free-text pack size, e.g. "500 g" — display-only "what it comes in". */
      packageSize: string | null;
      category: "Food";
      image: string | null;
    };

// Per-process limiter + cache (see rateLimit.helper for the scaling caveat).
const limiter = createRateLimiter({ max: 60, windowMs: 60_000 });
const cache = createTtlCache<BarcodeResult>({
  ttlMs: 24 * 60 * 60 * 1000,
  max: 2000,
});

/** Pull a unit token out of OFF's free-text quantity, e.g. "500 g" → "g". */
function parseUnit(quantity?: string): string | null {
  if (!quantity) return null;
  const m = quantity.match(/[a-zA-Z]+/);
  return m ? m[0].toLowerCase() : null;
}

export async function loader(args: LoaderFunctionArgs) {
  const { request } = args;

  // Authed-only: the scanner is part of the (edit-only) add-item flow. This
  // closes the open-proxy abuse vector.
  const { userId } = await getAuth(args);
  if (!userId) {
    return Response.json({ found: false } satisfies BarcodeResult, {
      status: 401,
    });
  }

  // Per-user rate limit.
  if (!limiter.take(userId)) {
    return Response.json({ found: false } satisfies BarcodeResult, {
      status: 429,
    });
  }

  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "").replace(/\D/g, "");

  if (!code || code.length < 8) {
    return Response.json({ found: false } satisfies BarcodeResult);
  }

  // Serve repeated scans of the same code from cache.
  const cached = cache.get(code);
  if (cached) return Response.json(cached);

  try {
    const fields = "product_name,brands,quantity,image_front_small_url";
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`,
      {
        headers: { "User-Agent": "Locavault/1.0 (inventory app)" },
        signal: AbortSignal.timeout(6000),
      },
    );

    if (!res.ok) return Response.json({ found: false } satisfies BarcodeResult);

    const data = (await res.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        brands?: string;
        quantity?: string;
        image_front_small_url?: string;
      };
    };

    if (data.status !== 1 || !data.product) {
      // Definitive "not in OFF" — cache so we don't re-query for this code.
      const miss = { found: false } satisfies BarcodeResult;
      cache.set(code, miss);
      return Response.json(miss);
    }

    const p = data.product;
    const name = (p.product_name || p.brands || "").trim();

    const result = {
      found: true,
      name,
      brand: p.brands?.trim() || null,
      unit: parseUnit(p.quantity),
      packageSize: p.quantity?.trim() || null,
      category: "Food",
      image: p.image_front_small_url || null,
    } satisfies BarcodeResult;
    cache.set(code, result);
    return Response.json(result);
  } catch {
    return Response.json({ found: false } satisfies BarcodeResult);
  }
}
