import {
  useLocation,
  useParams,
  useLoaderData,
  useFetcher,
} from "react-router";
import type { CreateStoreInput } from "../types/storeViewFinderTypes";
import type { Route } from "./+types/home";
import type { LayoutItem } from "react-grid-layout";
import { useState, useEffect, useMemo } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth";
import { getStoreById, getItemsByStore, createItem } from "~/lib/queries";
import { StoreHeader } from "~/components/store/storeHeader";
import { StoreLoading } from "~/components/store/storeLoading";
import { StoreToolbar } from "~/components/store/storeToolbar";
import { StoreTable } from "~/components/store/storeTable";
import { type Item } from "~/types/storeTypes";
import { ItemEditModal } from "~/components/store/itemEditModal";
import { handlesForMode } from "~/components/addstore/storeViewFinder/ModeToggle";
import { useZoom } from "~/utils/useZoom";
import { GridCanvas } from "~/components/addstore/storeViewFinder/GridCanvas";
import Navbar from "~/components/home/navbar";
import { AddItemPanel } from "~/components/addItem/addItemPanel";

// ── Meta ───────────────────────────────────────────────────
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Stores" },
    { name: "description", content: "See all your stores here." },
  ];
}

// ── Loader ─────────────────────────────────────────────────
export const loader = async (args: LoaderFunctionArgs) => {
  const userId = await requireAuth(args);
  const { params } = args;
  const [store, items] = await Promise.all([
    getStoreById(params.id!),
    getItemsByStore(params.id!),
  ]);
  return { userId, store, items };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const data = await request.json();

  if (data._action === "createItem") {
    await createItem({
      name: data.name,
      storeId: params.id!,
      quantity: data.quantity,
      description: data.description,
      blockId: data.blockId ?? undefined,
    });
    return { ok: true };
  }
};

// ── Helpers ────────────────────────────────────────────────
function blocksToLayoutAndStyles(blocks: CreateStoreInput["blocks"]) {
  const layout: LayoutItem[] = [];
  const blockStyles: Record<string, any> = {};

  blocks.forEach((block) => {
    layout.push({
      i: block.block_id,
      x: block.x,
      y: block.y,
      w: block.width,
      h: block.height,
      static: true,
      minW: 1,
      minH: 1,
    });

    blockStyles[block.block_id] = {
      bg: block.background,
      border: block.border,
      label: block.label,
    };
  });

  return { layout, blockStyles };
}

// ── Page ───────────────────────────────────────────────────
export default function StorePage() {
  const { store: dbStore, items: dbItems } = useLoaderData<typeof loader>();
  const { state } = useLocation();
  const { id } = useParams();

  const navStore: CreateStoreInput | null = state?.storeData ?? null;
  const initial = navStore ?? dbStore;

  // ── State ──
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [store, setStore] = useState<CreateStoreInput | null>(initial);
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
  const [addItemOpen, setAddItemOpen] = useState(false);

  // ── Effects ──
  useEffect(() => {
    setMounted(true);
    if (!navStore && !dbStore) setIsLoading(true);
  }, []);

  useEffect(() => {
    if (!dbStore) return;
    console.log(store, dbStore);
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

  // ── Derived ──
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [items, search]);

  // ── Handlers ──
  const handleSelectItem = (item: Item) => {
    setSelectedItemId(item.id);
    setHighlightedCell(item.blockId);
  };

  const handleSaveItem = (updated: Item) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingItem(null);
  };

  const fetcher = useFetcher();

  const handleAddItem = (data: {
    name: string;
    description: string;
    quantity: number;
    selectedBlockId?: string | null;
    inStore: boolean;
  }) => {
    const newItem: Item = {
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description,
      quantity: data.quantity,
      storeId: id!,
      blockId: data.selectedBlockId ?? null,
      createdAt: new Date(),
    };

    // Optimistically add to local state instantly
    setItems((prev) => [...prev, newItem]);
    setAddItemOpen(false);

    // Persist to DB in background
    fetcher.submit(
      {
        _action: "createItem",
        name: data.name,
        description: data.description,
        quantity: data.quantity,
        blockId: data.selectedBlockId ?? null,
      },
      { method: "POST", encType: "application/json" },
    );
  };

  // ── Early returns ──
  if (!mounted) {
    return (
      <div className="flex flex-col h-screen w-full bg-slate-50 pt-16 overflow-hidden">
        <div className="flex items-center gap-3 px-6 h-14 shrink-0 border-b border-slate-200 bg-white" />
      </div>
    );
  }

  if (isLoading) return <StoreLoading />;

  if (!store) {
    return (
      <div>
        <Navbar />
        <div className="flex flex-col items-center justify-center h-screen w-full gap-2">
          <p className="text-slate-400 font-mono text-[11px] uppercase tracking-widest">
            Store not found
          </p>
        </div>
      </div>
    );
  }

  // ── Render ──
  return (
    <div>
      <Navbar />
      <div className="flex flex-col h-screen w-full bg-slate-50 font-mono pt-16 overflow-hidden">
        <StoreToolbar
          storeId={id!}
          search={search}
          onSearchChange={setSearch}
          onAddItem={() => setAddItemOpen(true)}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Canvas */}
          <div className="flex flex-col w-1/2 border-r border-slate-200 overflow-hidden">
            <div className="px-4 h-10 flex items-center border-b border-slate-100 shrink-0 bg-white">
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
                  onClick={(_, blockId) => {
                    setHighlightedCell(blockId);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Inventory */}
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
              onSave={handleSaveItem}
            />
          </div>
        </div>

        <ItemEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveItem}
        />
      </div>
      <AddItemPanel
        isOpen={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        onSubmit={handleAddItem}
        selectedBlockId={highlightedCell}
        selectedBlockLabel={blockStyles[highlightedCell ?? ""]?.label ?? ""}
      />
    </div>
  );
}
