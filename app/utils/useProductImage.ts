import { useEffect, useState } from "react";
import type { Item } from "~/types/storeTypes";

/**
 * Lazily resolve a product photo for an item from its barcode (Open Food Facts,
 * via /api/barcode). Food-only, best-effort, module-cached and de-duped so a
 * grid of cards triggers at most one request per barcode. Returns null until
 * (and unless) an image is found — callers fall back to the type glyph.
 */
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function fetchImage(code: string): Promise<string | null> {
  if (cache.has(code)) return Promise.resolve(cache.get(code) ?? null);
  let p = inflight.get(code);
  if (!p) {
    p = fetch(`/api/barcode?code=${code}`)
      .then((r) => r.json())
      .then((d) => (d?.found && d.image ? (d.image as string) : null))
      .catch(() => null)
      .then((url) => {
        cache.set(code, url);
        inflight.delete(code);
        return url;
      });
    inflight.set(code, p);
  }
  return p;
}

export function useProductImage(
  item: Pick<Item, "itemType" | "sku">,
): string | null {
  const code =
    item.itemType === "food" && item.sku ? item.sku.replace(/\D/g, "") : "";
  const eligible = code.length >= 8;
  const [url, setUrl] = useState<string | null>(() =>
    eligible ? (cache.get(code) ?? null) : null,
  );

  useEffect(() => {
    if (!eligible) {
      setUrl(null);
      return;
    }
    if (cache.has(code)) {
      setUrl(cache.get(code) ?? null);
      return;
    }
    let active = true;
    fetchImage(code).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [code, eligible]);

  return url;
}
