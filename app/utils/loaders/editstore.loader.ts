import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getAuth } from "~/lib/auth";
import {
  updateStoreWithBlocks,
  verifyStoreAccess,
  getCustomFixturesByUser,
  getCustomFixturesByIds,
} from "~/lib/queries";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
import type { Wall } from "~/types/wallTypes";
import { clampGridDim } from "~/lib/gridLimits";
import {
  requireText,
  optText,
  validateBlocks,
} from "~/utils/helpers/validate.helper";

// ── Loader ─────────────────────────────────────────────────

export const loader = async (args: LoaderFunctionArgs) => {
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const { params } = args;
  const result = await verifyStoreAccess(params.id!, userId);

  if (!result) throw new Response("Store not found", { status: 404 });
  if (!["owner", "editor"].includes(result.accessLevel)) {
    throw new Response("Forbidden", { status: 403 });
  }

  const { store } = result;

  const blocksMap: BlocksMap = Object.fromEntries(
    store.blocks.map((b) => [
      b.block_id,
      {
        x: b.x,
        y: b.y,
        w: b.width,
        h: b.height,
        bg: b.background,
        border: b.border,
        label: b.label,
        kind: b.kind,
        fixture: b.fixture ?? null,
      },
    ]),
  );

  // The editor's own fixture palette PLUS any custom fixtures already placed on
  // this store's blocks (owned by whoever created the store) — resolved by id so
  // an editor of a shared store sees the existing fixtures, not blank tiles.
  const [ownFixtures, placedFixtures] = await Promise.all([
    getCustomFixturesByUser(userId),
    getCustomFixturesByIds(
      store.blocks.map((b) => b.fixture).filter((f): f is string => !!f),
    ),
  ]);
  const byId = new Map(ownFixtures.map((f) => [f.id, f]));
  for (const f of placedFixtures) if (!byId.has(f.id)) byId.set(f.id, f);
  const customFixtures = [...byId.values()];

  return {
    userId,
    customFixtures,
    initialData: {
      storeId: store.id,
      name: store.name,
      tags: JSON.parse(store.tags ?? "[]") as string[],
      description: store.description ?? "",
      rows: store.rows,
      cols: store.cols,
      blocks: blocksMap,
      walls: store.walls ?? [],
    },
  };
};

// ── Action ─────────────────────────────────────────────────

export const action = async (args: ActionFunctionArgs) => {
  const { request, params } = args;
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const result = await verifyStoreAccess(params.id!, userId);
  if (!result || !["owner", "editor"].includes(result.accessLevel)) {
    throw new Response("Forbidden", { status: 403 });
  }

  const data = await request.json();

  // Mirror addstore's validation: a store can't be edited nameless, with an
  // absurd grid, or with an unbounded/malformed block array.
  await updateStoreWithBlocks(params.id!, {
    name: requireText(data.name, "Store name", 120),
    tags: typeof data.tags === "string" ? data.tags.slice(0, 2000) : "[]",
    description: optText(data.description) ?? undefined,
    rows: clampGridDim(data.rows),
    cols: clampGridDim(data.cols),
    blocks: validateBlocks(data.blocks),
    walls: Array.isArray(data.walls)
      ? (data.walls.slice(0, 5000) as Wall[])
      : [],
  });

  return { ok: true };
};
