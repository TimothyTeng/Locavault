// Pure parsing for the "import recipe from a URL" feature (DESIGN.md §7). Given a
// page's HTML, pull the first schema.org/Recipe out of its JSON-LD and normalise
// it to our shapes. No network here — the route (api.recipe-import.ts) handles
// fetching + the SSRF guard; this stays pure so it's unit-testable.

import type { RecipeIngredient, RecipeStep } from "~/types/recipeTypes";
import { normalizeUnit } from "./units";

export type ImportedRecipe = {
  name: string;
  blurb?: string;
  imageUrl?: string;
  sourceUrl?: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  minutes?: number;
  serves?: number;
  tags?: string[];
};

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
};

/** "PT1H30M" → 90. Returns undefined for non-durations or zero-length. */
export function iso8601ToMinutes(raw: unknown): number | undefined {
  if (typeof raw !== "string") return undefined;
  const m = raw.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return undefined;
  const total =
    Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : undefined;
}

/** Parse a single number-ish token: "2", "1.5", "1/2", "1 1/2", "½", "1½". */
function parseQuantity(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  let total = 0;
  let matched = false;
  for (const part of trimmed.split(/\s+/)) {
    const v = parsePart(part);
    if (v == null) break;
    total += v;
    matched = true;
  }
  return matched ? total : null;
}

function parsePart(p: string): number | null {
  if (UNICODE_FRACTIONS[p] != null) return UNICODE_FRACTIONS[p];
  const last = p[p.length - 1];
  if (UNICODE_FRACTIONS[last] != null) {
    const head = p.slice(0, -1);
    const h = head ? Number(head) : 0;
    if (isFinite(h)) return h + UNICODE_FRACTIONS[last];
  }
  if (/^\d+\/\d+$/.test(p)) {
    const [a, b] = p.split("/").map(Number);
    return b ? a / b : null;
  }
  const n = Number(p.replace(",", "."));
  return isFinite(n) ? n : null;
}

// Order matters: more-specific branches first. The mixed-unicode branch
// (`\d*[fraction]`) must precede the plain-integer branch so "1½" isn't cut to "1".
const QTY_RE =
  /^((?:\d+\s+\d+\/\d+)|(?:\d*[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])|(?:\d+\/\d+)|(?:\d+(?:[.,]\d+)?))/;

/**
 * Best-effort parse of an ingredient line like "2 tablespoons olive oil" into
 * `{ name: "olive oil", amount: 2, unit: "tbsp" }`. Falls back to `{ name }` when
 * there's no leading measurement.
 */
export function parseIngredientLine(raw: string): RecipeIngredient {
  let line = raw.replace(/\s+/g, " ").trim();
  if (!line) return { name: "" };

  let amount: number | undefined;
  const qm = line.match(QTY_RE);
  if (qm) {
    const v = parseQuantity(qm[1]);
    if (v != null) amount = v;
    line = line.slice(qm[0].length).trim();
    // Drop a range remainder ("-3", "to 3").
    line = line.replace(/^(?:[-–]|to)\s*[\d./]+\s*/i, "").trim();
  }

  let unit: string | undefined;
  const uw = line.match(/^([a-zA-Z]+)\b/);
  if (uw) {
    const u = normalizeUnit(uw[1]);
    if (u) {
      unit = u;
      line = line.slice(uw[0].length).trim();
    }
  }

  line = line.replace(/^of\s+/i, "").trim();

  const name = line || raw.trim();
  const ing: RecipeIngredient = { name };
  if (amount != null) ing.amount = amount;
  if (unit) ing.unit = unit;
  return ing;
}

/**
 * Parse a stand-alone measure string (e.g. TheMealDB's `strMeasure`: "2
 * tablespoons", "1/2 cup", "200g", "to taste") into just an amount + unit,
 * ignoring any trailing prose. Returns `{}` when there's no leading quantity.
 */
export function parseMeasure(raw: string): { amount?: number; unit?: string } {
  let line = raw.replace(/\s+/g, " ").trim();
  if (!line) return {};
  const out: { amount?: number; unit?: string } = {};
  const qm = line.match(QTY_RE);
  if (qm) {
    const v = parseQuantity(qm[1]);
    if (v != null) out.amount = v;
    line = line.slice(qm[0].length).trim();
  }
  const uw = line.match(/^([a-zA-Z]+)\b/);
  if (uw) {
    const u = normalizeUnit(uw[1]);
    if (u) out.unit = u;
  }
  return out;
}

/** recipeYield: number | "4 servings" | array → a count. */
export function parseYield(raw: unknown): number | undefined {
  if (typeof raw === "number" && isFinite(raw)) return Math.round(raw);
  if (Array.isArray(raw)) {
    for (const r of raw) {
      const v = parseYield(r);
      if (v) return v;
    }
    return undefined;
  }
  if (typeof raw === "string") {
    const m = raw.match(/\d+/);
    if (m) return Number(m[0]);
  }
  return undefined;
}

function collectSteps(node: unknown, out: string[]): void {
  if (!node) return;
  if (typeof node === "string") {
    const t = node.trim();
    if (t) out.push(t);
    return;
  }
  if (Array.isArray(node)) {
    for (const n of node) collectSteps(n, out);
    return;
  }
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (Array.isArray(o.itemListElement)) {
      collectSteps(o.itemListElement, out);
      return;
    }
    if (typeof o.text === "string") {
      const t = o.text.trim();
      if (t) out.push(t);
      return;
    }
    if (typeof o.name === "string") {
      const t = o.name.trim();
      if (t) out.push(t);
    }
  }
}

function extractImage(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    for (const r of raw) {
      const v = extractImage(r);
      if (v) return v;
    }
    return undefined;
  }
  if (raw && typeof raw === "object") {
    const u = (raw as Record<string, unknown>).url;
    if (typeof u === "string") return u;
  }
  return undefined;
}

function isRecipeNode(o: Record<string, unknown>): boolean {
  const t = o["@type"];
  if (typeof t === "string") return t.toLowerCase().includes("recipe");
  if (Array.isArray(t))
    return t.some(
      (x) => typeof x === "string" && x.toLowerCase().includes("recipe"),
    );
  return false;
}

function findRecipe(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n);
      if (r) return r;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  if (isRecipeNode(o)) return o;
  if (Array.isArray(o["@graph"])) return findRecipe(o["@graph"]);
  return null;
}

/** Pull all `<script type="application/ld+json">` payloads out of a page. */
function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      // ignore malformed blocks
    }
  }
  return out;
}

/**
 * Find the first schema.org/Recipe in a page's JSON-LD and normalise it.
 * Returns null when the page exposes no recipe structured data.
 */
export function parseRecipeFromJsonLd(html: string): ImportedRecipe | null {
  let recipe: Record<string, unknown> | null = null;
  for (const block of jsonLdBlocks(html)) {
    recipe = findRecipe(block);
    if (recipe) break;
  }
  if (!recipe) return null;

  const name = typeof recipe.name === "string" ? recipe.name.trim() : "";
  if (!name) return null;

  const ingredients = Array.isArray(recipe.recipeIngredient)
    ? (recipe.recipeIngredient as unknown[])
        .filter((x): x is string => typeof x === "string")
        .map(parseIngredientLine)
        .filter((i) => i.name)
    : [];

  const stepTexts: string[] = [];
  collectSteps(recipe.recipeInstructions, stepTexts);
  const steps: RecipeStep[] = stepTexts.map((text) => ({ text }));

  const minutes =
    iso8601ToMinutes(recipe.totalTime) ??
    iso8601ToMinutes(recipe.cookTime) ??
    iso8601ToMinutes(recipe.prepTime);

  const out: ImportedRecipe = { name, ingredients, steps };
  const blurb =
    typeof recipe.description === "string"
      ? recipe.description.trim().slice(0, 400)
      : undefined;
  if (blurb) out.blurb = blurb;
  const imageUrl = extractImage(recipe.image);
  if (imageUrl) out.imageUrl = imageUrl;
  if (minutes) out.minutes = minutes;
  const serves = parseYield(recipe.recipeYield);
  if (serves) out.serves = serves;
  return out;
}
