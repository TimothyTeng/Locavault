import { parseGs1 } from "./gs1.helper";

export type BarcodeInfo = {
  /** The barcode value to store as SKU (GTIN when GS1, else the raw code) */
  sku: string;
  name?: string;
  unit?: string;
  /** Free-text pack size from the product DB, e.g. "500 g" (display-only). */
  packageSize?: string;
  expiry?: Date;
  weightKg?: number;
  category?: "Food";
};

/** Category labels that should receive auto-shelved food items */
export const FOOD_CATEGORY_RE = /food|grocer|pantry|fridge|freezer|produce/i;

/**
 * Turn a scanned/typed barcode into structured item info.
 * - GS1 Application Identifiers are parsed locally (expiry, weight, GTIN).
 * - Plain retail GTINs are looked up via /api/barcode (Open Food Facts).
 * Best-effort: network failures just yield whatever was parsed locally.
 */
export async function resolveBarcode(raw: string): Promise<BarcodeInfo> {
  const gs1 = parseGs1(raw);
  const code = (gs1.gtin ?? raw).replace(/[^0-9A-Za-z]/g, "");

  const info: BarcodeInfo = { sku: code };
  if (gs1.expiry) info.expiry = gs1.expiry;
  if (gs1.weightKg) {
    info.weightKg = gs1.weightKg;
    info.unit = "kg";
  }

  const numeric = code.replace(/\D/g, "");
  if (numeric.length >= 8) {
    try {
      const res = await fetch(`/api/barcode?code=${numeric}`);
      const data = await res.json();
      if (data?.found) {
        if (data.name) info.name = data.name;
        if (data.unit && !info.unit) info.unit = data.unit;
        if (data.packageSize) info.packageSize = data.packageSize;
        if (data.category) info.category = data.category;
      }
    } catch {
      /* lookup is best-effort */
    }
  }

  return info;
}
