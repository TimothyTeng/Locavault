import { useLocation, useParams, useLoaderData } from "react-router";
import type { CreateStoreInput } from "../types/storeViewFinderTypes";
import type { Route } from "./+types/home";
import { GridCanvas } from "~/components/addstore/storeViewFinder/GridCanvas";
import type { LayoutItem } from "react-grid-layout";
import { useState, useEffect } from "react";
import { useZoom } from "~/utils/useZoom";
import { handlesForMode } from "~/components/addstore/storeViewFinder/ModeToggle";
import { getStoreById } from "~/lib/queries";
import type { LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Stores" },
    { name: "description", content: "See all your stores here." },
  ];
}

export const loader = async (args: LoaderFunctionArgs) => {
  const userId = await requireAuth(args);
  const { params } = args;
  const store = await getStoreById(params.id!);
  return { userId, store };
};

function blocksToLayoutAndStyles(blocks: CreateStoreInput["blocks"]) {
  const layout: LayoutItem[] = [];
  const blockStyles: Record<string, any> = {};

  blocks.forEach((block, i) => {
    const key = `block-${i}`;
    layout.push({
      i: key,
      x: block.x,
      y: block.y,
      w: block.width,
      h: block.height,
      minW: 1,
      minH: 1,
    });
    blockStyles[key] = {
      bg: block.background,
      border: block.border,
      label: block.label,
    };
  });

  return { layout, blockStyles };
}

export default function StorePage() {
  const { store: dbStore } = useLoaderData<typeof loader>();
  const { state } = useLocation();
  const navStore: CreateStoreInput | null = state?.storeData ?? null;

  const initial = navStore ?? dbStore;

  const [store, setStore] = useState<CreateStoreInput | null>(initial);
  const [isLoading, setIsLoading] = useState(!navStore);

  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    if (!initial) return [];
    return blocksToLayoutAndStyles(initial.blocks).layout;
  });

  const [blockStyles, setBlockStyles] = useState<Record<string, any>>(() => {
    if (!initial) return {};
    return blocksToLayoutAndStyles(initial.blocks).blockStyles;
  });

  const { zoom, setZoom } = useZoom(0.5, 3);
  const [currentSelection, setCurrentSelection] = useState<string | null>(null);
  const handles = handlesForMode("select");

  useEffect(() => {
    if (!dbStore) return;

    setStore(dbStore);
    setIsLoading(false);

    const { layout: dbLayout, blockStyles: dbStyles } = blocksToLayoutAndStyles(
      dbStore.blocks,
    );

    setLayout((prev) => {
      const prevStr = JSON.stringify(prev);
      const nextStr = JSON.stringify(dbLayout);
      return prevStr === nextStr ? prev : dbLayout;
    });

    setBlockStyles((prev) => {
      const prevStr = JSON.stringify(prev);
      const nextStr = JSON.stringify(dbStyles);
      return prevStr === nextStr ? prev : dbStyles;
    });
  }, [dbStore]);

  const selectedBlock = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    setCurrentSelection(id);
  };

  const { id } = useParams();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full gap-4">
        <div
          className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-slate-600"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
        <p className="text-slate-400 font-mono text-[11px] uppercase tracking-widest">
          Loading store...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full gap-2">
        <p className="text-slate-400 font-mono text-[11px] uppercase tracking-widest">
          Store not found
        </p>
      </div>
    );
  }

  const tags: string[] = JSON.parse(store.tags ?? "[]");

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 font-mono !p-6 !pt-20 gap-6">
      {/* ── Header ── */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold text-slate-800">{store.name}</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {store.cols} × {store.rows} grid · {store.blocks.length} block
              {store.blocks.length !== 1 ? "s" : ""}
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-300">{id}</span>
        </div>

        {/* Grid Canvas */}
        <div style={{ width: `${zoom * 100}%` }}>
          <GridCanvas
            cols={store.cols}
            rows={store.rows}
            layout={layout}
            blockStyles={blockStyles}
            handles={handles}
            selectedId={currentSelection}
            onClick={(e, id) => selectedBlock(e, id)}
          />
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border bg-slate-100 border-slate-300 text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {store.description && (
          <p className="text-[12px] text-slate-500 leading-relaxed">
            {store.description}
          </p>
        )}
      </div>

      {/* ── Blocks ── */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Blocks
        </span>
        {store.blocks.length === 0 ? (
          <p className="text-[12px] text-slate-300">No blocks added.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {store.blocks.map((block, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-md border border-slate-100 bg-slate-50"
              >
                <div
                  className="w-6 h-6 rounded shrink-0 border"
                  style={{
                    background: block.background,
                    borderColor: block.border,
                  }}
                />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] font-bold text-slate-700 truncate">
                    {block.label || "Untitled"}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {block.width}w × {block.height}h · ({block.x}, {block.y})
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
