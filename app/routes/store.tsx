import {
  useLocation,
  useParams,
  useLoaderData,
  useFetcher,
} from "react-router";
import type {
  CreateStoreInput,
  BlocksMap,
} from "../types/storeViewFinderTypes";
import type { Route } from "./+types/home";
import { useState, useEffect, useMemo } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import {
  verifyStoreAccess,
  getItemsByStore,
  getMembersByStore,
  createItem,
  updateItem,
  removeMember,
  createInvite,
  updateStoreVisibility,
  updateItemVisibility,
} from "~/lib/queries";
import { StoreHeader } from "~/components/store/storeHeader";
import { StoreLoading } from "~/components/store/storeLoading";
import { StoreToolbar } from "~/components/store/storeToolbar";
import { StoreTable } from "~/components/store/storeTable";
import { type Item } from "~/types/storeTypes";
import type { AccessLevel, StoreMember } from "~/types/memberTypes";
import { ItemEditModal } from "~/components/store/itemEditModal";
import { handlesForMode } from "~/components/addstore/storeViewFinder/ModeToggle";
import { useZoom } from "~/utils/useZoom";
import { GridCanvas } from "~/components/addstore/storeViewFinder/GridCanvas";
import Navbar from "~/components/home/navbar";
import { AddItemPanel } from "~/components/addItem/addItemPanel";
import { MembersPanel } from "~/components/store/membersPanel";

// ── Meta ───────────────────────────────────────────────────
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Stores" },
    { name: "description", content: "See all your stores here." },
  ];
}

// ── Loader ─────────────────────────────────────────────────
export const loader = async (args: LoaderFunctionArgs) => {
  const { userId } = await getAuth(args);
  const { params } = args;

  const access = await verifyStoreAccess(params.id!, userId ?? null);

  if (!access) {
    return {
      notFound: true,
      accessLevel: "none" as AccessLevel,
      store: null,
      items: [],
      members: [],
      userId,
    };
  }

  const { store, accessLevel } = access;

  if (accessLevel === "none") {
    return {
      notFound: false,
      accessLevel,
      store: null,
      items: [],
      members: [],
      userId,
    };
  }

  const [allItems, members] = await Promise.all([
    getItemsByStore(params.id!),
    accessLevel === "owner"
      ? getMembersByStore(params.id!)
      : Promise.resolve([]),
  ]);

  const items =
    accessLevel === "public" || accessLevel === "viewer"
      ? allItems.filter((i) => i.isPublic)
      : allItems;

  return { notFound: false, accessLevel, store, items, members, userId };
};

// ── Action ─────────────────────────────────────────────────
export const action = async (args: ActionFunctionArgs) => {
  const { request, params } = args;
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const data = await request.json();

  if (data._action === "createItem") {
    const newItem = await createItem({
      name: data.name,
      storeId: params.id!,
      quantity: data.quantity,
      description: data.description,
      blockId: data.blockId ?? undefined,
    });
    return { ok: true, id: newItem.id, optimisticId: data.optimisticId };
  }

  if (data._action === "updateItem") {
    await updateItem(data.id, {
      name: data.name,
      quantity: data.quantity,
      description: data.description,
      storeId: data.storeId,
      blockId: data.blockId,
    });
    return { ok: true };
  }

  if (data._action === "removeMember") {
    await removeMember(params.id!, data.userId);
    return { ok: true };
  }

  if (data._action === "createInvite") {
    const token = await createInvite(params.id!, "editor", userId);
    return { ok: true, token };
  }

  if (data._action === "updateVisibility") {
    await updateStoreVisibility(params.id!, {
      isPublic: data.isPublic,
      canvasVisible: data.canvasVisible,
    });
    return { ok: true };
  }

  if (data._action === "updateItemVisibility") {
    await updateItemVisibility(data.itemId, data.isPublic);
    return { ok: true };
  }

  return { ok: false };
};

// ── Helpers ────────────────────────────────────────────────
function blocksToBlocksMap(blocks: CreateStoreInput["blocks"]): BlocksMap {
  return Object.fromEntries(
    blocks.map((block) => [
      block.block_id,
      {
        x: block.x,
        y: block.y,
        w: block.width,
        h: block.height,
        bg: block.background,
        border: block.border,
        label: block.label,
      },
    ]),
  );
}

// ── Page ───────────────────────────────────────────────────
export default function StorePage() {
  const {
    store: dbStore,
    items: dbItems,
    members: dbMembers,
    accessLevel,
    notFound,
    userId,
  } = useLoaderData<typeof loader>();

  const { state } = useLocation();
  const { id } = useParams();

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

  // Swap optimistic item ID with real server ID once createItem resolves
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

  if (notFound) {
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

  if (accessLevel === "none") {
    return (
      <div>
        <Navbar />
        <div className="flex flex-col items-center justify-center h-screen w-full gap-2">
          <p className="text-slate-800 font-mono text-sm font-bold">
            This store is private
          </p>
          <p className="text-slate-400 font-mono text-[11px]">
            You need an invite to view this store.
          </p>
        </div>
      </div>
    );
  }

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
