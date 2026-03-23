import {
  useLocation,
  useParams,
  useLoaderData,
  useFetcher,
  useRevalidator,
} from "react-router";
import type {
  CreateStoreInput,
  BlocksMap,
} from "../types/storeViewFinderTypes";
import type { Route } from "./+types/home";
import { useState, useEffect, useMemo } from "react";
import { StoreHeader } from "~/components/store/storeHeader";
import { StoreLoading } from "~/components/store/storeLoading";
import { StoreToolbar } from "~/components/store/storeToolbar";
import { StoreTable } from "~/components/store/storeTable";
import { type Item } from "~/types/storeTypes";
import type { StoreMember } from "~/types/memberTypes";
import { ItemEditModal } from "~/components/store/itemEditModal";
import { handlesForMode } from "~/components/addstore/storeViewFinder/ModeToggle";
import { useZoom } from "~/utils/useZoom";
import { GridCanvas } from "~/components/addstore/storeViewFinder/GridCanvas";
import Navbar from "~/components/home/navbar";
import { AddItemPanel } from "~/components/addItem/addItemPanel";
import { MembersPanel } from "~/components/store/membersPanel";
import { blocksToBlocksMap } from "#utils/helpers/store.helper";
import type { loader } from "#utils/loaders/store.loader";

export { loader, action } from "#utils/loaders/store.loader";

const POLL_INTERVAL_MS = 15_000;

// ── Meta ───────────────────────────────────────────────────
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Stores" },
    { name: "description", content: "See all your stores here." },
  ];
}

// ── Page ───────────────────────────────────────────────────
export default function StorePage() {
  const {
    store: dbStore,
    items: dbItems,
    members: dbMembers,
    accessLevel,
    userId,
  } = useLoaderData<typeof loader>();

  const { state } = useLocation();
  const { id } = useParams();
  const { revalidate } = useRevalidator();

  const navStore: CreateStoreInput | null = state?.storeData ?? null;
  const initial = navStore ?? dbStore;

  // ── State ──
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [store, setStore] = useState<CreateStoreInput | null>(initial);
  const [blocks, setBlocks] = useState<BlocksMap>(() =>
    initial ? blocksToBlocksMap(initial.blocks) : {},
  );
  const [items, setItems] = useState<Item[]>(
    ((dbItems as Item[]) ?? []).map((i) => ({
      ...i,
      isPublic: i.isPublic ?? true,
    })),
  );
  const [members, setMembers] = useState<StoreMember[]>(
    (dbMembers as StoreMember[]) ?? [],
  );
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [highlightedCell, setHighlightedCell] = useState<string | null>(null);
  const [membersPanelOpen, setMembersPanelOpen] = useState(false);

  const { zoom } = useZoom(0.5, 3);
  const handles = handlesForMode("select");
  const [addItemOpen, setAddItemOpen] = useState(false);

  const fetcher = useFetcher();
  const createFetcher = useFetcher();

  // ── Polling ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        document.visibilityState !== "visible" ||
        createFetcher.state !== "idle"
      )
        return;
      revalidate();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [revalidate, createFetcher.state]);

  // ── Effects ──
  useEffect(() => {
    setMounted(true);
    if (!navStore && !dbStore) setIsLoading(true);
  }, []);

  useEffect(() => {
    if (!dbStore) return;
    setStore(dbStore);
    setIsLoading(false);
    const mapped = blocksToBlocksMap(dbStore.blocks);
    setBlocks((prev) =>
      JSON.stringify(prev) === JSON.stringify(mapped) ? prev : mapped,
    );
  }, [dbStore]);

  useEffect(() => {
    if (!dbItems || createFetcher.state !== "idle") return;
    setItems(
      (dbItems as Item[]).map((i) => ({ ...i, isPublic: i.isPublic ?? true })),
    );
  }, [dbItems]);

  useEffect(() => {
    if (!dbMembers) return;
    setMembers(dbMembers as StoreMember[]);
  }, [dbMembers]);

  useEffect(() => {
    const result = createFetcher.data as any;
    if (!result?.id || !result?.optimisticId) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === result.optimisticId ? { ...i, id: result.id } : i,
      ),
    );
  }, [createFetcher.data]);

  // ── Derived ──
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [items, search]);

  const canEdit = accessLevel === "owner" || accessLevel === "editor";
  const isOwner = accessLevel === "owner";

  // ── Handlers ──
  const handleSelectItem = (item: Item) => {
    setSelectedItemId(item.id);
    setHighlightedCell(item.blockId);
  };

  const handleSaveItem = (updated: Item) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingItem(null);
    fetcher.submit(
      {
        _action: "updateItem",
        id: updated.id,
        name: updated.name,
        storeId: updated.storeId,
        description: updated.description,
        quantity: updated.quantity,
        blockId: updated.blockId,
      },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleAddItem = (data: {
    name: string;
    description: string;
    quantity: number;
    selectedBlockId?: string | null;
    inStore: boolean;
  }) => {
    const optimisticId = crypto.randomUUID();
    const newItem: Item = {
      id: optimisticId,
      name: data.name,
      description: data.description,
      quantity: data.quantity,
      storeId: id!,
      blockId: data.selectedBlockId ?? null,
      createdAt: new Date(),
      isPublic: true,
    };
    setItems((prev) => [...prev, newItem]);
    setAddItemOpen(false);
    createFetcher.submit(
      {
        _action: "createItem",
        name: data.name,
        description: data.description,
        quantity: data.quantity,
        blockId: data.selectedBlockId ?? null,
        optimisticId,
      },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleRemoveMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.userId !== memberId));
    fetcher.submit(
      { _action: "removeMember", userId: memberId },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleToggleStoreVisibility = (
    field: "isPublic" | "canvasVisible",
    value: boolean,
  ) => {
    setStore((prev) => (prev ? { ...prev, [field]: value } : prev));
    fetcher.submit(
      {
        _action: "updateVisibility",
        isPublic: field === "isPublic" ? value : (store?.isPublic ?? false),
        canvasVisible:
          field === "canvasVisible" ? value : (store?.canvasVisible ?? false),
      },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleToggleItemVisibility = (itemId: string, isPublic: boolean) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, isPublic } : i)),
    );
    fetcher.submit(
      { _action: "updateItemVisibility", itemId, isPublic },
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

  const showCanvas =
    isOwner ||
    accessLevel === "editor" ||
    accessLevel === "viewer" ||
    (accessLevel === "public" && store?.canvasVisible);

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
          onMembersToggle={() => setMembersPanelOpen((v) => !v)}
          accessLevel={accessLevel}
          store={store}
          onToggleVisibility={handleToggleStoreVisibility}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* Canvas */}
          <div
            className={`flex flex-col border-r border-slate-200 overflow-hidden ${
              showCanvas ? "w-1/2" : "hidden"
            }`}
          >
            <div className="px-4 h-10 flex items-center border-b border-slate-100 shrink-0 bg-white">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
                Floor Plan
              </span>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {store && <StoreHeader store={store} id={id} />}
              <div className="mt-4" style={{ width: `${zoom * 100}%` }}>
                <GridCanvas
                  cols={store!.cols}
                  rows={store!.rows}
                  blocks={blocks}
                  handles={handles}
                  selectedId={highlightedCell}
                  onClick={(_, blockId) => {
                    setHighlightedCell(blockId);
                  }}
                  readOnly={true}
                />
              </div>
            </div>
          </div>

          {/* Inventory */}
          <div
            className={`flex flex-col overflow-hidden ${
              showCanvas ? "w-1/2" : "w-full"
            }`}
          >
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
              accessLevel={accessLevel}
              onToggleItemVisibility={handleToggleItemVisibility}
            />
          </div>

          {/* Members panel */}
          {isOwner && (
            <MembersPanel
              isOpen={membersPanelOpen}
              members={members}
              onRemoveMember={handleRemoveMember}
              onClose={() => setMembersPanelOpen(false)}
            />
          )}
        </div>

        <ItemEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveItem}
        />
      </div>
      {canEdit && (
        <AddItemPanel
          isOpen={addItemOpen}
          onClose={() => setAddItemOpen(false)}
          onSubmit={handleAddItem}
          selectedBlockId={highlightedCell}
          selectedBlockLabel={blocks[highlightedCell ?? ""]?.label ?? ""}
        />
      )}
    </div>
  );
}
