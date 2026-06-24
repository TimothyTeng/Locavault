import type { ActionFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import {
  createUserRecipe,
  updateUserRecipe,
  deleteUserRecipe,
} from "~/lib/queries";
import type { RecipeIngredient, RecipeStep } from "~/types/recipeTypes";
import { normalizeUnit } from "~/utils/helpers/units";

/**
 * User-recipe CRUD (resource route, no UI). Client posts JSON with an `_action`
 * discriminator (create | update | delete). All mutations are scoped to the
 * signed-in user — `update`/`delete` only touch rows they own. Untrusted
 * ingredient/step/tag JSON is validated and clamped before it reaches the DB.
 */

const MAX_INGREDIENTS = 60;
const MAX_STEPS = 40;
const MAX_TAGS = 20;

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Keep a value only if it's a plausible http(s) URL. */
function safeUrl(v: unknown): string | null {
  const s = str(v, 2048);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? s : null;
  } catch {
    return null;
  }
}

function sanitizeIngredients(raw: unknown): RecipeIngredient[] {
  if (!Array.isArray(raw)) return [];
  const out: RecipeIngredient[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = str(o.name, 120);
    if (!name) continue;
    const ing: RecipeIngredient = { name };
    const amount = Number(o.amount);
    if (isFinite(amount) && amount > 0) ing.amount = amount;
    const unit = normalizeUnit(typeof o.unit === "string" ? o.unit : null);
    if (unit) ing.unit = unit;
    out.push(ing);
    if (out.length >= MAX_INGREDIENTS) break;
  }
  return out;
}

function sanitizeSteps(raw: unknown): RecipeStep[] {
  if (!Array.isArray(raw)) return [];
  const out: RecipeStep[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const text = str(o.text, 2000);
    if (!text) continue;
    const step: RecipeStep = { text };
    const img = safeUrl(o.imageUrl);
    if (img) step.imageUrl = img;
    out.push(step);
    if (out.length >= MAX_STEPS) break;
  }
  return out;
}

function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const r of raw) {
    const t = str(r, 30).toLowerCase();
    if (t) out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function optInt(v: unknown): number | null {
  const n = Number(v);
  return isFinite(n) && n > 0 ? Math.round(n) : null;
}

export async function action(args: ActionFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await args.request.json()) as Record<string, unknown>;
  const act = body._action;

  if (act === "create" || act === "update") {
    const name = str(body.name, 120);
    const ingredients = sanitizeIngredients(body.ingredients);
    if (!name) return Response.json({ error: "invalid" }, { status: 400 });

    const fields = {
      name,
      blurb: str(body.blurb, 400) || null,
      imageUrl: safeUrl(body.imageUrl),
      sourceUrl: safeUrl(body.sourceUrl),
      ingredients,
      steps: sanitizeSteps(body.steps),
      tags: sanitizeTags(body.tags),
      minutes: optInt(body.minutes),
      serves: optInt(body.serves),
    };

    if (act === "create") {
      const recipe = await createUserRecipe({ userId, ...fields });
      return Response.json({ recipe });
    }

    const id = String(body.id ?? "");
    const recipe = await updateUserRecipe(id, userId, fields);
    if (!recipe) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ recipe });
  }

  if (act === "delete") {
    const id = String(body.id ?? "");
    if (id) await deleteUserRecipe(id, userId);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "bad_action" }, { status: 400 });
}
