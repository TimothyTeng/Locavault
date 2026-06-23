import type { ActionFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import {
  createCustomFixture,
  updateCustomFixture,
  deleteCustomFixture,
} from "~/lib/queries";
import type { CustomShape } from "~/types/customFixtureTypes";
import type { FixtureCategory } from "~/types/fixtureTypes";

/**
 * Custom-fixture CRUD (resource route, no UI). Client posts JSON with an
 * `_action` discriminator (create | update | delete). All mutations are scoped
 * to the signed-in user — `update`/`delete` only touch rows they own.
 */

const CATEGORIES = ["storage", "furniture", "appliance", "object"];

/** Validate/clamp untrusted shape JSON before it hits the DB. */
function sanitizeShapes(raw: unknown): CustomShape[] {
  if (!Array.isArray(raw)) return [];
  const tones = new Set(["outline", "body", "light", "mid"]);
  const types = new Set(["rect", "bar", "circle"]);
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
  const out: CustomShape[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    if (!types.has(o.type as string) || !tones.has(o.tone as string)) continue;
    out.push({
      type: o.type as CustomShape["type"],
      tone: o.tone as CustomShape["tone"],
      x: num(o.x),
      y: num(o.y),
      w: Math.max(1, num(o.w)),
      h: Math.max(1, num(o.h)),
    });
    if (out.length >= 60) break; // hard cap on shapes per fixture
  }
  return out;
}

export async function action(args: ActionFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await args.request.json()) as Record<string, unknown>;
  const act = body._action;

  if (act === "create" || act === "update") {
    const name = String(body.name ?? "")
      .trim()
      .slice(0, 60);
    const category = (
      CATEGORIES.includes(body.category as string) ? body.category : "object"
    ) as FixtureCategory;
    const defaultColor = String(body.defaultColor ?? "#64748b").slice(0, 9);
    const shapes = sanitizeShapes(body.shapes);
    if (!name || shapes.length === 0)
      return Response.json({ error: "invalid" }, { status: 400 });

    if (act === "create") {
      const fixture = await createCustomFixture({
        userId,
        name,
        category,
        defaultColor,
        shapes,
      });
      return Response.json({ fixture });
    }

    const id = String(body.id ?? "");
    const fixture = await updateCustomFixture(id, userId, {
      name,
      category,
      defaultColor,
      shapes,
    });
    if (!fixture) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ fixture });
  }

  if (act === "delete") {
    const id = String(body.id ?? "");
    if (id) await deleteCustomFixture(id, userId);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "bad_action" }, { status: 400 });
}
