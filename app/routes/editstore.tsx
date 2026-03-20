import { useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { Show } from "@clerk/react-router";
import Navbar from "~/components/home/navbar";
import StoreViewFinder from "~/components/addstore/storeViewFinder/storeViewFinder";
import { requireAuth } from "~/lib/auth";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  getStoreById,
  updateStoreWithBlocks,
  verifyStoreOwner,
} from "~/lib/queries";
import { redirect } from "react-router";
import type { BlockDetails } from "~/types/storeViewFinderTypes";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Edit Store" },
    { name: "description", content: "Edit your store layout" },
  ];
}

// ── Loader ─────────────────────────────────────────────────

export const loader = async (args: LoaderFunctionArgs) => {
  const userId = await requireAuth(args);
  const { params } = args;

  const store = await getStoreById(params.id!);
  if (!store) throw new Response("Store not found", { status: 404 });

  // Only the owner can edit
  await verifyStoreOwner(params.id!, userId);

  // Convert DB blocks to BlocksMap for StoreViewFinder
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

export const action = async ({ request, params }: ActionFunctionArgs) => {
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

// ── Component ──────────────────────────────────────────────

export default function EditStore() {
  const { initialData } = useLoaderData<typeof loader>();

  return (
    <Show
      when="signed-in"
      fallback={
        <div className="flex items-center justify-center h-screen text-xs font-mono text-slate-400">
          You must be signed in to edit a store.
        </div>
      }
    >
      <div className="flex flex-col h-dvh overflow-hidden pt-[var(--navbar-height,64px)]">
        <Navbar />
        <div className="flex-1 min-h-0">
          <StoreViewFinder initialData={initialData} />
        </div>
      </div>
    </Show>
  );
}
