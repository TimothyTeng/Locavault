import type { LoaderFunctionArgs } from "react-router";

/**
 * Barcode → product info lookup (resource route, no UI).
 *
 * GET /api/barcode?code=<gtin>
 *
 * Uses Open Food Facts (free, no API key, global — covers 888-prefixed SG food).
 * Runs server-side so we control the User-Agent, map categories, and avoid CORS.
 * NOTE: this only resolves the *product identity* (name/brand/size). Expiry is
 * never in a retail barcode DB — that comes from the GS1 (17) field or the user.
 */

type BarcodeResult =
  | { found: false }
  | {
      found: true;
      name: string;
      brand: string | null;
      unit: string | null;
      category: "Food";
      image: string | null;
    };

/** Pull a unit token out of OFF's free-text quantity, e.g. "500 g" → "g". */
function parseUnit(quantity?: string): string | null {
  if (!quantity) return null;
  const m = quantity.match(/[a-zA-Z]+/);
  return m ? m[0].toLowerCase() : null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "").replace(/\D/g, "");

  if (!code || code.length < 8) {
    return Response.json({ found: false } satisfies BarcodeResult);
  }

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
      return Response.json({ found: false } satisfies BarcodeResult);
    }

    const p = data.product;
    const name = (p.product_name || p.brands || "").trim();

    return Response.json({
      found: true,
      name,
      brand: p.brands?.trim() || null,
      unit: parseUnit(p.quantity),
      category: "Food",
      image: p.image_front_small_url || null,
    } satisfies BarcodeResult);
  } catch {
    return Response.json({ found: false } satisfies BarcodeResult);
  }
}
