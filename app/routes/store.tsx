import { useLocation, useParams, useLoaderData } from "react-router";
import type { CreateStoreInput } from "../types/storeViewFinderTypes";
import type { Route } from "./+types/home";
import type { LayoutItem } from "react-grid-layout";
import { useState, useEffect, useMemo } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth";
import { getStoreById, getItemsByStore } from "~/lib/queries";
import { StoreHeader } from "~/components/store/storeHeader";
import { StoreLoading } from "~/components/store/storeLoading";
import { StoreToolbar } from "~/components/store/storeToolbar";
import { StoreTable, type Item } from "~/components/store/storeTable";
import { ItemEditModal } from "~/components/store/itemEditModal";
import { handlesForMode } from "~/components/addstore/storeViewFinder/ModeToggle";
import { useZoom } from "~/utils/useZoom";
import { GridCanvas } from "~/components/addstore/storeViewFinder/GridCanvas";
import Navbar from "~/components/home/navbar";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Stores" },
    { name: "description", content: "See all your stores here." },
  ];
}

export const loader = async (args: LoaderFunctionArgs) => {
  const userId = await requireAuth(args);
  const { params } = args;
  const [store, items] = await Promise.all([
    getStoreById(params.id!),
    getItemsByStore(params.id!),
  ]);
  return { userId, store, items };
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
  const { store: dbStore, items: dbItems } = useLoaderData<typeof loader>();
  const { state } = useLocation();
  const { id } = useParams();
  const [mounted, setMounted] = useState(false);
  const navStore: CreateStoreInput | null = state?.storeData ?? null;
  const initial = navStore ?? dbStore;

  const [store, setStore] = useState<CreateStoreInput | null>(initial);
  const [isLoading, setIsLoading] = useState(false); // always false on server

  const [layout, setLayout] = useState<LayoutItem[]>(() =>
    initial ? blocksToLayoutAndStyles(initial.blocks).layout : [],
  );
  const [blockStyles, setBlockStyles] = useState<Record<string, any>>(() =>
    initial ? blocksToLayoutAndStyles(initial.blocks).blockStyles : {},
  );

  const [items, setItems] = useState<Item[]>(dbItems ?? []);
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [highlightedCell, setHighlightedCell] = useState<string | null>(null);

  const { zoom } = useZoom(0.5, 3);
  const handles = handlesForMode("select");

  useEffect(() => {
    setMounted(true);
    if (!navStore && !dbStore) {
      setIsLoading(true);
    }
  }, []);
  useEffect(() => {
    if (!dbStore) return;
    setStore(dbStore);
    setIsLoading(false);
    const { layout: dbLayout, blockStyles: dbStyles } = blocksToLayoutAndStyles(
      dbStore.blocks,
    );
    setLayout((prev) =>
      JSON.stringify(prev) === JSON.stringify(dbLayout) ? prev : dbLayout,
    );
    setBlockStyles((prev) =>
      JSON.stringify(prev) === JSON.stringify(dbStyles) ? prev : dbStyles,
    );
  }, [dbStore]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [items, search]);

  const handleSelectItem = (item: Item) => {
    setSelectedItemId(item.id);
    setHighlightedCell(item.blockId);
  };

  const handleSaveItem = (updated: Item) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingItem(null);
    // TODO: persist via fetcher action
  };

  if (!mounted) {
    // Return same structure server and client agree on
    return (
      <div className="flex flex-col h-screen w-full bg-slate-50 font-mono pt-16 overflow-hidden">
        <div className="flex items-center gap-3 px-6 h-14 shrink-0 border-b border-slate-200 bg-white" />
      </div>
    );
  }
  if (isLoading) return <StoreLoading />;

  if (!store) {
    return (
      <div>
        <Navbar />
        <div className="flex flex-col items-center justify-center h-full w-full gap-2">
          <p className="text-slate-400 font-mono text-[11px] uppercase tracking-widest">
            Store not found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="flex flex-col h-screen w-full bg-slate-50 font-mono pt-16 overflow-hidden">
        <StoreToolbar
          storeId={id!}
          search={search}
          onSearchChange={setSearch}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* ── Left: Canvas ── */}
          <div className="flex flex-col w-1/2 border-r border-slate-200 bg-white overflow-hidden">
            <div className="px-4 h-10 flex items-center border-b border-slate-100 shrink-0">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
                Floor Plan
              </span>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <StoreHeader store={store} id={id} />
              <div className="mt-4" style={{ width: `${zoom * 100}%` }}>
                <GridCanvas
                  cols={store.cols}
                  rows={store.rows}
                  layout={layout}
                  blockStyles={blockStyles}
                  handles={handles}
                  selectedId={highlightedCell}
                  onClick={() => {}}
                />
              </div>
            </div>
          </div>

          {/* ── Right: Table ── */}
          <div className="flex flex-col w-1/2 overflow-hidden">
            <div className="px-4 h-10 flex items-center border-b border-slate-100 bg-white shrink-0">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
                Inventory · {filteredItems.length} item
                {filteredItems.length !== 1 ? "s" : ""}
              </span>
            </div>
            <StoreTable
              items={filteredItems}
              selectedItemId={selectedItemId}
              onSelect={handleSelectItem}
              onDoubleClick={setEditingItem}
            />
          </div>
        </div>

        <ItemEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveItem}
        />
      </div>
    </div>
  );
}
