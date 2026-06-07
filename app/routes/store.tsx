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
import { useState, useEffect, useRef } from "react";
import { StoreHeader } from "~/components/store/storeHeader";
import { StoreLoading } from "~/components/store/storeLoading";
import { StoreToolbar } from "~/components/store/storeToolbar";
import { StoreTable } from "~/components/store/storeTable";
import { type Item } from "~/types/storeTypes";
import type { StoreMember } from "~/types/memberTypes";
import { handlesForMode } from "~/components/addstore/storeViewFinder/ModeToggle";
import { useZoom } from "~/utils/useZoom";
import { GridCanvas } from "~/components/addstore/storeViewFinder/GridCanvas";
import Navbar from "~/components/home/navbar";
import { AddItemPanel } from "~/components/addItem/addItemPanel";
import { MembersPanel } from "~/components/store/membersPanel";
import { MiniMap } from "~/components/store/minimap";
import { blocksToBlocksMap } from "#utils/helpers/store.helper";
import { getItemStatus } from "#utils/helpers/storeTable.helper";
import { useIsMobile } from "~/utils/useIsMobile";
import type { loader } from "#utils/loaders/store.loader";
import { PurchaseOrderPanel } from "~/components/purchases/purchaseOrderPanel";
import type { PurchaseOrderItem } from "~/types/purchaseOrderTypes";
import {
  type BarcodeInfo,
  FOOD_CATEGORY_RE,
} from "#utils/helpers/barcode.helper";

export { loader, action } from "#utils/loaders/store.loader";

const POLL_INTERVAL_MS = 15_000;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Stores" },
    { name: "description", content: "See all your stores here." },
  ];
}

export default function StorePage() {
  const {
    store: dbStore,
    items: dbItems,
    members: dbMembers,
    accessLevel,
    userId,
    purchaseOrders,
  } = useLoaderData<typeof loader>();

  const { state } = useLocation();
  const { id } = useParams();
  const { revalidate } = useRevalidator();
  const isMobile = useIsMobile();

  const navStore: CreateStoreInput | null = state?.storeData ?? null;
  const initial = navStore ?? dbStore;

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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [highlightedCell, setHighlightedCell] = useState<string | null>(null);
  const [membersPanelOpen, setMembersPanelOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [minimapExpanded, setMinimapExpanded] = useState(false);

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderItem[]>(
    (purchaseOrders as PurchaseOrderItem[]) ?? [],
  );
  const [purchaseOrderOpen, setPurchaseOrderOpen] = useState(false);
  // Ids the user has ticked off ("got it") but not yet committed to inventory
  const [checkedPOIds, setCheckedPOIds] = useState<Set<string>>(new Set());

  const { zoom, setZoom } = useZoom(0.5, 3);
  const onZoomIn = () => setZoom((z: number) => Math.min(3, z + 0.1));
  const onZoomOut = () => setZoom((z: number) => Math.max(0.5, z - 0.1));
  const handles = handlesForMode("select");
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

  const canEdit = accessLevel === "owner" || accessLevel === "editor";
  const isOwner = accessLevel === "owner";

  // How many inventory items currently need restocking (low / out / expiring)
  const restockCount = items.filter(
    (i) => getItemStatus(i) !== "ok",
  ).length;

  // Labelled standard blocks act as categories / shelves in the add-item form
  const categories = Object.entries(blocks)
    .filter(
      ([, b]) =>
        (b.kind === "standard" || b.kind === undefined) && b.label.trim(),
    )
    .map(([id, b]) => ({ id, label: b.label }));

  useEffect(() => {
    // Re-sync the shopping list from the server, but not while a mutation is
    // mid-flight (would clobber optimistic adds/edits).
    if (!purchaseOrders || fetcher.state !== "idle") return;
    setPurchaseOrder(purchaseOrders as PurchaseOrderItem[]);
  }, [purchaseOrders]);

  // ── Handlers ──
  const handleSelectItem = (item: Item) => {
    setSelectedItemId(item.id);
    setHighlightedCell(item.blockId);
  };

  const handleSaveItem = (updated: Item) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    fetcher.submit(
      {
        _action: "updateItem",
        id: updated.id,
        name: updated.name,
        storeId: updated.storeId,
        description: updated.description,
        quantity: updated.quantity,
        blockId: updated.blockId,
        sku: updated.sku ?? null,
        unit: updated.unit ?? null,
        minQuantity: updated.minQuantity ?? null,
        cost: updated.cost ?? null,
        expiryDate: updated.expiryDate
          ? updated.expiryDate.toISOString()
          : null,
        useRate: updated.useRate ?? null,
        useRatePeriod: updated.useRatePeriod ?? null,
      },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleDeleteItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    if (selectedItemId === itemId) setSelectedItemId(null);
    fetcher.submit(
      { _action: "deleteItem", id: itemId },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleAddItem = (data: {
    name: string;
    description: string;
    quantity: number;
    selectedBlockId?: string | null;
    inStore: boolean;
    sku?: string | null;
    unit?: string | null;
    minQuantity?: number | null;
    cost?: number | null;
    expiryDate?: Date | null;
    useRate?: number | null;
    useRatePeriod?: "day" | "week" | "month" | null;
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
      sku: data.sku ?? null,
      unit: data.unit ?? null,
      minQuantity: data.minQuantity ?? null,
      cost: data.cost ?? null,
      expiryDate: data.expiryDate ?? null,
      useRate: data.useRate ?? null,
      useRatePeriod: data.useRatePeriod ?? null,
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
        sku: data.sku ?? null,
        unit: data.unit ?? null,
        minQuantity: data.minQuantity ?? null,
        cost: data.cost ?? null,
        expiryDate: data.expiryDate ? data.expiryDate.toISOString() : null,
        useRate: data.useRate ?? null,
        useRatePeriod: data.useRatePeriod ?? null,
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

  const handleAddPOItem = () => {
    const optimisticId = crypto.randomUUID();
    const newPO: PurchaseOrderItem = {
      id: optimisticId,
      itemId: null,
      storeId: id!,
      name: "New item",
      quantity: 1,
      blockId: null,
      description: null,
      sku: null,
      unit: null,
      minQuantity: null,
      cost: null,
      expiryDate: null,
      useRate: null,
      useRatePeriod: null,
      createdAt: new Date(),
      createdBy: userId ?? null,
    };
    setPurchaseOrder((prev) => [...prev, newPO]);
    fetcher.submit(
      { _action: "createPOItem", name: "New item", quantity: 1, optimisticId },
      { method: "POST", encType: "application/json" },
    );
  };

  // Add a shopping-list row from a scanned barcode
  const handleAddScannedPOItem = (info: BarcodeInfo) => {
    const optimisticId = crypto.randomUUID();

    // Auto-shelf food to a matching block (best-effort)
    let scannedBlockId: string | null = null;
    if (info.category === "Food") {
      const foodBlock = Object.entries(blocks).find(
        ([, b]) =>
          (b.kind === "standard" || b.kind === undefined) &&
          FOOD_CATEGORY_RE.test(b.label),
      );
      if (foodBlock) scannedBlockId = foodBlock[0];
    }

    const newPO: PurchaseOrderItem = {
      id: optimisticId,
      itemId: null,
      storeId: id!,
      name: info.name || "New item",
      quantity: 1,
      blockId: scannedBlockId,
      description: null,
      sku: info.sku || null,
      unit: info.unit ?? null,
      minQuantity: null,
      cost: null,
      expiryDate: info.expiry ?? null,
      useRate: null,
      useRatePeriod: null,
      createdAt: new Date(),
      createdBy: userId ?? null,
    };
    setPurchaseOrder((prev) => [...prev, newPO]);
    fetcher.submit(
      {
        _action: "createPOItem",
        name: newPO.name,
        quantity: 1,
        blockId: scannedBlockId,
        sku: newPO.sku,
        unit: newPO.unit,
        expiryDate: info.expiry ? info.expiry.toISOString() : null,
        optimisticId,
      },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleUpdatePOItem = (updated: PurchaseOrderItem) => {
    setPurchaseOrder((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
    fetcher.submit(
      {
        _action: "updatePOItem",
        id: updated.id,
        name: updated.name,
        quantity: updated.quantity,
        blockId: updated.blockId ?? null,
        description: updated.description ?? null,
        sku: updated.sku ?? null,
        unit: updated.unit ?? null,
        minQuantity: updated.minQuantity ?? null,
        cost: updated.cost ?? null,
        expiryDate: updated.expiryDate
          ? updated.expiryDate.toISOString()
          : null,
        useRate: updated.useRate ?? null,
        useRatePeriod: updated.useRatePeriod ?? null,
      },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleDeletePOItem = (poId: string) => {
    setPurchaseOrder((prev) => prev.filter((p) => p.id !== poId));
    fetcher.submit(
      { _action: "deletePOItem", id: poId },
      { method: "POST", encType: "application/json" },
    );
  };

  // Apply the optimistic inventory + list changes for buying one PO row
  const applyBuyOptimistic = (poRow: PurchaseOrderItem) => {
    setPurchaseOrder((prev) => prev.filter((p) => p.id !== poRow.id));
    if (poRow.itemId) {
      // Known item — add quantity to existing
      setItems((prev) =>
        prev.map((i) =>
          i.id === poRow.itemId
            ? { ...i, quantity: i.quantity + poRow.quantity }
            : i,
        ),
      );
    } else {
      // New item — add to inventory
      setItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: poRow.name,
          quantity: poRow.quantity,
          storeId: id!,
          blockId: poRow.blockId,
          description: poRow.description,
          createdAt: new Date(),
          isPublic: true,
          sku: poRow.sku,
          unit: poRow.unit,
          minQuantity: poRow.minQuantity,
          cost: poRow.cost,
          expiryDate: poRow.expiryDate,
          useRate: poRow.useRate,
          useRatePeriod: poRow.useRatePeriod,
        },
      ]);
    }
  };

  // Quick-buy: commit a single row to inventory immediately
  const handleBuyPOItem = (poId: string) => {
    const poRow = purchaseOrder.find((p) => p.id === poId);
    if (!poRow) return;
    setCheckedPOIds((prev) => {
      if (!prev.has(poId)) return prev;
      const next = new Set(prev);
      next.delete(poId);
      return next;
    });
    applyBuyOptimistic(poRow);
    fetcher.submit(
      { _action: "buyPOItem", id: poId },
      { method: "POST", encType: "application/json" },
    );
  };

  // Toggle a row's "got it" tick (does not touch inventory)
  const handleTogglePOChecked = (poId: string) => {
    setCheckedPOIds((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });
  };

  // Commit every ticked row to inventory in a single request
  const handleCommitCheckedPO = () => {
    const rows = purchaseOrder.filter((p) => checkedPOIds.has(p.id));
    if (!rows.length) return;
    rows.forEach(applyBuyOptimistic);
    setCheckedPOIds(new Set());
    fetcher.submit(
      { _action: "buyPOItems", ids: rows.map((r) => r.id) },
      { method: "POST", encType: "application/json" },
    );
  };

  // Suggested restock quantity — refill to ~2× min stock (fallback: 1)
  const suggestedQty = (item: Item) => {
    const target = item.minQuantity != null ? item.minQuantity * 2 : 1;
    return Math.max(target - item.quantity, 1);
  };

  // Build an optimistic PO row + its server payload from an inventory item
  const buildPOFromItem = (item: Item) => {
    const optimisticId = crypto.randomUUID();
    const quantity = suggestedQty(item);
    const optimistic: PurchaseOrderItem = {
      id: optimisticId,
      itemId: item.id, // ← link to existing item
      storeId: id!,
      name: item.name,
      quantity,
      blockId: item.blockId,
      description: item.description,
      sku: item.sku,
      unit: item.unit,
      minQuantity: item.minQuantity,
      cost: item.cost,
      expiryDate: null,
      useRate: item.useRate,
      useRatePeriod: item.useRatePeriod,
      createdAt: new Date(),
      createdBy: userId ?? null,
    };
    const payload = {
      itemId: item.id,
      name: item.name,
      quantity,
      blockId: item.blockId ?? null,
      description: item.description ?? null,
      sku: item.sku ?? null,
      unit: item.unit ?? null,
      minQuantity: item.minQuantity ?? null,
      cost: item.cost ?? null,
      expiryDate: null,
      useRate: item.useRate ?? null,
      useRatePeriod: item.useRatePeriod ?? null,
    };
    return { optimistic, payload, optimisticId };
  };

  const handleAddPOItemFromSuggestion = (item: Item) => {
    const { optimistic, payload, optimisticId } = buildPOFromItem(item);
    setPurchaseOrder((prev) => [...prev, optimistic]);
    fetcher.submit(
      { _action: "createPOItem", ...payload, optimisticId },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleAddAllSuggestions = (suggested: Item[]) => {
    if (!suggested.length) return;
    const built = suggested.map(buildPOFromItem);
    setPurchaseOrder((prev) => [...prev, ...built.map((b) => b.optimistic)]);
    fetcher.submit(
      { _action: "createPOItems", items: built.map((b) => b.payload) },
      { method: "POST", encType: "application/json" },
    );
  };

  // ── Deselect on outside click (desktop only) ──
  const tableRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: MouseEvent) => {
      // While the Add Item / Shopping List panels are open, the highlighted
      // block is the active assignment target — don't clear it on outside clicks.
      if (addItemOpen || purchaseOrderOpen) return;
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setSelectedItemId(null);
        setHighlightedCell(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile, addItemOpen, purchaseOrderOpen]);

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
      <div className="flex flex-col h-dvh overflow-hidden bg-white md:pt-16 font-mono">
        <StoreToolbar
          storeId={id!}
          onAddItem={() => setAddItemOpen(true)}
          onMembersToggle={() => setMembersPanelOpen((v) => !v)}
          accessLevel={accessLevel}
          store={store}
          onToggleVisibility={handleToggleStoreVisibility}
          isMobile={isMobile}
          restockCount={restockCount}
          onPurchaseOrder={() => {
            setAddItemOpen(false);
            setPurchaseOrderOpen((v) => !v);
          }}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* ── Desktop canvas (left pane) ── */}
          {!isMobile && (
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
                {store && (
                  <StoreHeader
                    store={store}
                    id={id}
                    zoom={zoom}
                    onZoomIn={onZoomIn}
                    onZoomOut={onZoomOut}
                  />
                )}
                <div className="mt-4" style={{ width: `${zoom * 100}%` }}>
                  <GridCanvas
                    cols={store!.cols}
                    rows={store!.rows}
                    blocks={blocks}
                    handles={handles}
                    selectedId={highlightedCell}
                    onClick={(_, blockId) => setHighlightedCell(blockId)}
                    readOnly={true}
                    nonClickableKinds={["divider", "stairs"]}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Inventory (full width on mobile, half on desktop) ── */}
          <div
            ref={tableRef}
            className={`flex flex-col overflow-hidden ${
              !isMobile && showCanvas ? "w-1/2" : "w-full"
            }`}
          >
            <StoreTable
              items={items}
              selectedItemId={selectedItemId}
              onSelect={handleSelectItem}
              onSave={handleSaveItem}
              onDelete={handleDeleteItem}
              accessLevel={accessLevel}
              storeIsPublic={store?.isPublic ?? false}
              onToggleItemVisibility={handleToggleItemVisibility}
              isMobile={isMobile}
              minimapExpanded={minimapExpanded}
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
      </div>

      {/* ── Mobile minimap (floating bottom-left) ── */}
      {isMobile && showCanvas && store && (
        <MiniMap
          blocks={blocks}
          cols={store.cols}
          rows={store.rows}
          handles={handles}
          selectedId={highlightedCell}
          onClick={(_, blockId) => setHighlightedCell(blockId)}
          // Force expand when AddItem panel is open so map fills bottom half
          forceExpanded={addItemOpen}
          expanded={minimapExpanded}
          onToggleExpanded={setMinimapExpanded}
          zoom={zoom}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
        />
      )}

      {/* ── Add Item panel ── */}
      {canEdit && (
        <AddItemPanel
          isOpen={addItemOpen}
          onClose={() => setAddItemOpen(false)}
          onSubmit={handleAddItem}
          categories={categories}
          selectedBlockId={highlightedCell}
          selectedBlockLabel={blocks[highlightedCell ?? ""]?.label ?? ""}
          isMobile={isMobile}
        />
      )}
      {canEdit && (
        <PurchaseOrderPanel
          isOpen={purchaseOrderOpen}
          onClose={() => setPurchaseOrderOpen(false)}
          items={purchaseOrder}
          blocks={blocks}
          storeItems={items}
          checkedIds={checkedPOIds}
          onToggleChecked={handleTogglePOChecked}
          onCommitChecked={handleCommitCheckedPO}
          onAdd={handleAddPOItem}
          onAddScanned={handleAddScannedPOItem}
          onAddFromSuggestion={handleAddPOItemFromSuggestion}
          onAddAll={handleAddAllSuggestions}
          onUpdate={handleUpdatePOItem}
          onDelete={handleDeletePOItem}
          onBuy={handleBuyPOItem}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
