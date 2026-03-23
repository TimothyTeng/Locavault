import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { updateStoreWithBlocks, verifyStoreAccess } from "~/lib/queries";
import type { BlockDetails } from "~/types/storeViewFinderTypes";

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

  const blocksMap = Object.fromEntries(
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
      },
    ]),
  );

  return {
    userId,
    initialData: {
      storeId: store.id,
      name: store.name,
      tags: JSON.parse(store.tags ?? "[]") as string[],
      description: store.description ?? "",
      rows: store.rows,
      cols: store.cols,
      blocks: blocksMap,
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

  await updateStoreWithBlocks(params.id!, {
    name: data.name,
    tags: data.tags,
    description: data.description,
    rows: data.rows,
    cols: data.cols,
    blocks: data.blocks as BlockDetails[],
  });

  return { ok: true };
};