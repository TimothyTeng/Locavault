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
import { Map as MapIcon, List as ListIcon } from "lucide-react";
import { StoreHeader } from "~/components/store/storeHeader";
import { StoreLoading } from "~/components/store/storeLoading";
import { StoreToolbar } from "~/components/store/storeToolbar";
import { StoreTable } from "~/components/store/storeTable";
import { type Item, type ItemStatus } from "~/types/storeTypes";
import type { ItemType } from "~/types/itemTypeTypes";
import type { StoreMember } from "~/types/memberTypes";
import { handlesForMode } from "~/components/addstore/storeViewFinder/ModeToggle";
import { useZoom } from "~/utils/useZoom";
import { GridCanvas } from "~/components/addstore/storeViewFinder/GridCanvas";
import Navbar from "~/components/home/navbar";
import { AddItemPanel } from "~/components/addItem/addItemPanel";
import {
  QuickAddPanel,
  type QuickAddItem,
} from "~/components/addItem/quickAddPanel";
import { RecipesPanel } from "~/components/recipes/recipesPanel";
import { CollectionsPanel } from "~/components/collections/collectionsPanel";
import type { Collection, CollectionKind } from "~/types/collectionTypes";
import { MembersPanel } from "~/components/store/membersPanel";
import { MiniMap } from "~/components/store/minimap";
import { StoreOverview } from "~/components/store/storeOverview";
import { StoreMapView } from "~/components/store/storeMapView";
import { ItemCardGrid } from "~/components/store/itemCardGrid";
import { GlobalSearch } from "~/components/store/globalSearch";
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
    collections: dbCollections,
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
  // The zone whose contents the right pane is scoped to (canvas-primary). Null =
  // show the whole store (overview + all items).
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  // Optional status filter driven by the overview chips (all-items view).
  const [statusFilter, setStatusFilter] = useState<ItemStatus | null>(null);
  // All-items view: cards (visual, default) or table (sort/filter power).
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  // Top-level surface: the map IS the app (default), or the flat inventory list.
  const [pageView, setPageView] = useState<"map" | "inventory">("map");
  const [membersPanelOpen, setMembersPanelOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [minimapExpanded, setMinimapExpanded] = useState(false);

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderItem[]>(
    (purchaseOrders as PurchaseOrderItem[]) ?? [],
  );
  const [purchaseOrderOpen, setPurchaseOrderOpen] = useState(false);

  const [collections, setCollections] = useState<Collection[]>(
    (dbCollections as Collection[]) ?? [],
  );
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  // Ids the user has ticked off ("got it") but not yet committed to inventory
  const [checkedPOIds, setCheckedPOIds] = useState<Set<string>>(new Set());

  const { zoom, setZoom } = useZoom(0.5, 3);
  const onZoomIn = () => setZoom((z: number) => Math.min(3, z + 0.1));
  const onZoomOut = () => setZoom((z: number) => Math.max(0.5, z - 0.1));
  const handles = handlesForMode("select");
  const fetcher = useFetcher();
  const createFetcher = useFetcher();
  const collectionFetcher = useFetcher();

  // ── Polling ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        document.visibilityState !== "visible" ||
        createFetcher.state !== "idle" ||
        collectionFetcher.state !== "idle"
      )
        return;
      revalidate();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [revalidate, createFetcher.state, collectionFetcher.state]);

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

  // Re-sync collections from the server, but not while a collection mutation is
  // mid-flight (would clobber optimistic changes). Ids are client-generated, so
  // local and server rows reconcile cleanly.
  useEffect(() => {
    if (!dbCollections || collectionFetcher.state !== "idle") return;
    setCollections(dbCollections as Collection[]);
  }, [dbCollections]);

  useEffect(() => {
    const result = createFetcher.data as any;
    // Bulk quick-add: reconcile each optimistic id to its real id.
    if (Array.isArray(result?.created)) {
      setItems((prev) =>
        prev.map((i) => {
          const m = result.created.find((c: any) => c.optimisticId === i.id);
          return m ? { ...i, id: m.id } : i;
        }),
      );
      return;
    }
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
  const restockCount = items.filter((i) => getItemStatus(i) !== "ok").length;

  // Per-zone status badges for the canvas: worst severity + count of items
  // needing attention, so the floor plan reads as a triage dashboard.
  const blockBadges = items.reduce<
    Record<string, { count: number; tone: "critical" | "attention" }>
  >((acc, item) => {
    if (!item.blockId) return acc;
    const status = getItemStatus(item);
    if (status === "ok") return acc;
    const tone: "critical" | "attention" =
      status === "out" ? "critical" : "attention";
    const cur = acc[item.blockId];
    if (!cur) acc[item.blockId] = { count: 1, tone };
    else {
      cur.count += 1;
      if (tone === "critical") cur.tone = "critical";
    }
    return acc;
  }, {});

  // Right-pane scoping: when a zone is focused, show only its items.
  const zoneLabel = focusedZoneId ? blocks[focusedZoneId]?.label : null;
  const visibleItems = focusedZoneId
    ? items.filter((i) => i.blockId === focusedZoneId)
    : items;

  // Out/low items not already queued on the shopping list — "add all" targets.
  const restockCandidates = items.filter((i) => {
    const s = getItemStatus(i);
    return (
      (s === "out" || s === "low") &&
      !purchaseOrder.some((p) => p.itemId === i.id)
    );
  });

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

  // Clicking a zone on the canvas scopes the right pane to that zone's contents.
  const handleZoneClick = (blockId: string) => {
    setHighlightedCell(blockId);
    setFocusedZoneId(blockId);
    setStatusFilter(null);
  };

  // Global-search "jump": surface the item on the map — open & pulse its zone.
  const handleJumpToItem = (item: Item) => {
    setStatusFilter(null);
    setSelectedItemId(item.id);
    setFocusedZoneId(item.blockId ?? null);
    setHighlightedCell(item.blockId ?? null);
    if (item.blockId) setPageView("map");
  };

  // Open the add-item panel pre-targeted to a zone (or unassigned).
  const handleAddItemToZone = (blockId: string | null) => {
    setHighlightedCell(blockId);
    setAddItemOpen(true);
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
        itemType: updated.itemType,
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

  // One-tap "we're out": zero the quantity locally, queue a restock, and let the
  // server log the depletion (which trains the usage estimate).
  const handleMarkItemOut = (item: Item) => {
    const restockQty = suggestedQty(item);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, quantity: 0 } : i)),
    );
    if (!purchaseOrder.some((p) => p.itemId === item.id)) {
      const { optimistic } = buildPOFromItem(item);
      setPurchaseOrder((prev) => [...prev, optimistic]);
    }
    fetcher.submit(
      { _action: "markItemOut", id: item.id, restockQty },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleAddItem = (data: {
    name: string;
    description: string;
    quantity: number;
    selectedBlockId?: string | null;
    inStore: boolean;
    itemType: ItemType;
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
      itemType: data.itemType,
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
        itemType: data.itemType,
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

  // Bulk quick-capture: create many items at once (optimistic + reconciled).
  const handleQuickAdd = (entries: QuickAddItem[], blockId: string | null) => {
    if (!entries.length) return;
    const built = entries.map((e) => {
      const optimisticId = crypto.randomUUID();
      const item: Item = {
        id: optimisticId,
        name: e.name,
        description: "",
        quantity: e.quantity,
        storeId: id!,
        blockId: blockId ?? null,
        createdAt: new Date(),
        isPublic: true,
        itemType: e.itemType,
        sku: null,
        unit: null,
        minQuantity: null,
        cost: null,
        expiryDate: null,
        useRate: null,
        useRatePeriod: null,
      };
      return {
        item,
        payload: {
          optimisticId,
          name: e.name,
          quantity: e.quantity,
          blockId: blockId ?? null,
          itemType: e.itemType,
        },
      };
    });
    setItems((prev) => [...prev, ...built.map((b) => b.item)]);
    createFetcher.submit(
      { _action: "createItems", items: built.map((b) => b.payload) },
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
          itemType: "other",
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

  // Suggested restock quantity.
  // If we've learned a usage rate, buy enough to cover the next ~30 days (while
  // staying above min stock). Otherwise fall back to refilling to ~2× min.
  const RESTOCK_HORIZON_DAYS = 30;
  const suggestedQty = (item: Item) => {
    const rate = item.usage?.dailyRate ?? null;
    if (rate && rate > 0) {
      const horizonNeed =
        Math.ceil(rate * RESTOCK_HORIZON_DAYS) - item.quantity;
      const minNeed =
        item.minQuantity != null ? item.minQuantity - item.quantity : 0;
      return Math.max(horizonNeed, minNeed, 1);
    }
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

  // Recipes → shopping list: add the lacking ingredient names (plain, unlinked
  // PO rows), skipping any already queued. Optimistic, reconciled by polling.
  const handleAddMissingToList = (names: string[]) => {
    const existing = new Set(purchaseOrder.map((p) => p.name.toLowerCase()));
    const fresh = names.filter((n) => !existing.has(n.toLowerCase()));
    if (!fresh.length) return;
    const built = fresh.map((name) => {
      const optimisticId = crypto.randomUUID();
      const optimistic: PurchaseOrderItem = {
        id: optimisticId,
        itemId: null,
        storeId: id!,
        name,
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
      return { optimistic, payload: { name, quantity: 1 } };
    });
    setPurchaseOrder((prev) => [...prev, ...built.map((b) => b.optimistic)]);
    fetcher.submit(
      { _action: "createPOItems", items: built.map((b) => b.payload) },
      { method: "POST", encType: "application/json" },
    );
  };

  // Lowercase names already on the shopping list — lets recipe cards show which
  // missing ingredients are already queued.
  const listedNames = new Set(purchaseOrder.map((p) => p.name.toLowerCase()));

  // ── Collections / packing ──
  const submitCollection = (
    payload: Record<string, string | number | boolean | null>,
  ) =>
    collectionFetcher.submit(payload, {
      method: "POST",
      encType: "application/json",
    });

  const patchCollection = (id: string, fn: (c: Collection) => Collection) =>
    setCollections((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));

  const handleCreateCollection = (
    cid: string,
    name: string,
    kind: CollectionKind,
  ) => {
    setCollections((prev) => [
      {
        id: cid,
        storeId: id!,
        name,
        description: null,
        kind,
        checkedOut: false,
        userId: userId ?? "",
        createdAt: new Date(),
        items: [],
      },
      ...prev,
    ]);
    submitCollection({ _action: "createCollection", id: cid, name, kind });
  };

  const handleRenameCollection = (cid: string, name: string) => {
    patchCollection(cid, (c) => ({ ...c, name }));
    submitCollection({ _action: "updateCollection", id: cid, name });
  };

  const handleSetCollectionKind = (cid: string, kind: CollectionKind) => {
    patchCollection(cid, (c) => ({ ...c, kind }));
    submitCollection({ _action: "updateCollection", id: cid, kind });
  };

  const handleDeleteCollection = (cid: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== cid));
    submitCollection({ _action: "deleteCollection", id: cid });
  };

  const handleAddCollectionItem = (
    cid: string,
    entry: { id: string; itemId: string | null; name: string },
  ) => {
    patchCollection(cid, (c) => ({
      ...c,
      items: [
        ...c.items,
        {
          id: entry.id,
          collectionId: cid,
          itemId: entry.itemId,
          name: entry.name,
          desiredQty: 1,
          checked: false,
          createdAt: new Date(),
        },
      ],
    }));
    submitCollection({
      _action: "addCollectionItem",
      id: entry.id,
      collectionId: cid,
      itemId: entry.itemId,
      name: entry.name,
    });
  };

  const handleToggleCollectionPacked = (
    cid: string,
    ciId: string,
    checked: boolean,
  ) => {
    patchCollection(cid, (c) => ({
      ...c,
      items: c.items.map((ci) => (ci.id === ciId ? { ...ci, checked } : ci)),
    }));
    submitCollection({
      _action: "updateCollectionItem",
      id: ciId,
      collectionId: cid,
      checked,
    });
  };

  const handleRemoveCollectionItem = (cid: string, ciId: string) => {
    patchCollection(cid, (c) => ({
      ...c,
      items: c.items.filter((ci) => ci.id !== ciId),
    }));
    submitCollection({
      _action: "removeCollectionItem",
      id: ciId,
      collectionId: cid,
    });
  };

  const handleCheckoutCollection = (cid: string, checkedOut: boolean) => {
    const target = collections.find((c) => c.id === cid);
    const linkedItemIds = new Set(
      (target?.items ?? [])
        .map((ci) => ci.itemId)
        .filter((x): x is string => !!x),
    );
    patchCollection(cid, (c) => ({
      ...c,
      checkedOut,
      items: checkedOut
        ? c.items.map((ci) => ({ ...ci, checked: true }))
        : c.items,
    }));
    // Reflect the transient loan state on the linked inventory items.
    setItems((prev) =>
      prev.map((i) => (linkedItemIds.has(i.id) ? { ...i, checkedOut } : i)),
    );
    submitCollection({
      _action: "setCollectionCheckedOut",
      id: cid,
      checkedOut,
    });
  };

  // ── Deselect on outside click (desktop only) ──
  const tableRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: MouseEvent) => {
      // The map manages its own selection/highlight lifecycle.
      if (pageView === "map") return;
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
  }, [isMobile, addItemOpen, purchaseOrderOpen, pageView]);

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

  // The map is the primary surface, but only when a canvas is actually available.
  const effectiveView: "map" | "inventory" =
    showCanvas && pageView === "map" ? "map" : "inventory";

  // ── Render ──
  return (
    <div>
      <Navbar />
      <div className="flex flex-col h-dvh overflow-hidden bg-white md:pt-16 font-mono">
        <StoreToolbar
          storeId={id!}
          onAddItem={() => setAddItemOpen(true)}
          onQuickAdd={() => {
            setAddItemOpen(false);
            setQuickAddOpen(true);
          }}
          onRecipes={() => {
            setAddItemOpen(false);
            setRecipesOpen((v) => !v);
          }}
          onCollections={() => {
            setAddItemOpen(false);
            setCollectionsOpen((v) => !v);
          }}
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

        {/* Global item search — always available, jumps to an item's zone */}
        <div className="flex items-center gap-3 px-4 md:px-6 h-11 border-b border-slate-200 bg-white shrink-0">
          <GlobalSearch
            items={items}
            blocks={blocks}
            onJump={handleJumpToItem}
          />
          <div className="flex-1" />
          {showCanvas && (
            <div className="flex items-center rounded-md border border-slate-200 overflow-hidden shrink-0">
              <SurfaceBtn
                active={pageView === "map"}
                onClick={() => setPageView("map")}
                label="Map"
                icon={<MapIcon size={13} />}
              />
              <SurfaceBtn
                active={pageView === "inventory"}
                onClick={() => setPageView("inventory")}
                label="Inventory"
                icon={<ListIcon size={13} />}
              />
            </div>
          )}
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {effectiveView === "map" && store ? (
            /* ── Map-first surface: the floor plan IS the app ── */
            <StoreMapView
              blocks={blocks}
              cols={store.cols}
              rows={store.rows}
              items={items}
              canEdit={canEdit}
              isOwner={isOwner}
              storeIsPublic={store?.isPublic ?? false}
              pulseZoneId={highlightedCell}
              pulseItemId={selectedItemId}
              onSaveItem={handleSaveItem}
              onDeleteItem={handleDeleteItem}
              onMarkOut={canEdit ? handleMarkItemOut : undefined}
              onAddToList={canEdit ? handleAddPOItemFromSuggestion : undefined}
              onToggleVisibility={handleToggleItemVisibility}
              onAddItemToZone={handleAddItemToZone}
            />
          ) : (
            <>
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
                        onClick={(_, blockId) => handleZoneClick(blockId)}
                        readOnly={true}
                        nonClickableKinds={["divider", "stairs"]}
                        blockBadges={blockBadges}
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
                {focusedZoneId ? (
                  // ── Zone-scoped contents: type-aware cards ──
                  <>
                    <div className="px-3 py-2 border-b border-slate-100 bg-white shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => setFocusedZoneId(null)}
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 10 10"
                          fill="none"
                        >
                          <path
                            d="M6 1L2 5l4 4"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        All items
                      </button>
                      <span className="text-slate-200">/</span>
                      <span className="text-[11px] font-mono font-semibold text-slate-700 truncate">
                        {zoneLabel || "Zone"}
                      </span>
                      <span className="text-[9px] font-mono text-slate-300">
                        {visibleItems.length} item
                        {visibleItems.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <ItemCardGrid
                      items={visibleItems}
                      onSave={handleSaveItem}
                      onDelete={handleDeleteItem}
                      onMarkOut={canEdit ? handleMarkItemOut : undefined}
                      onAddToList={
                        canEdit ? handleAddPOItemFromSuggestion : undefined
                      }
                      isOwner={isOwner}
                      storeIsPublic={store?.isPublic ?? false}
                      onToggleVisibility={handleToggleItemVisibility}
                      emptyLabel="Nothing in this zone yet"
                      bottomPad={isMobile && minimapExpanded}
                    />
                  </>
                ) : (
                  // ── Whole-store: overview action queue + cards / table ──
                  <>
                    <StoreOverview
                      items={items}
                      restockCandidates={restockCandidates}
                      onAddAll={canEdit ? handleAddAllSuggestions : undefined}
                      activeStatus={statusFilter}
                      onSelectStatus={(s) =>
                        setStatusFilter((prev) => (prev === s ? null : s))
                      }
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                    />
                    {viewMode === "cards" ? (
                      <ItemCardGrid
                        items={
                          statusFilter
                            ? items.filter(
                                (i) => getItemStatus(i) === statusFilter,
                              )
                            : items
                        }
                        onSave={handleSaveItem}
                        onDelete={handleDeleteItem}
                        onMarkOut={canEdit ? handleMarkItemOut : undefined}
                        onAddToList={
                          canEdit ? handleAddPOItemFromSuggestion : undefined
                        }
                        isOwner={isOwner}
                        storeIsPublic={store?.isPublic ?? false}
                        onToggleVisibility={handleToggleItemVisibility}
                        emptyLabel="No items yet"
                        bottomPad={isMobile && minimapExpanded}
                      />
                    ) : (
                      <StoreTable
                        items={
                          statusFilter
                            ? items.filter(
                                (i) => getItemStatus(i) === statusFilter,
                              )
                            : items
                        }
                        selectedItemId={selectedItemId}
                        onSelect={handleSelectItem}
                        onSave={handleSaveItem}
                        onDelete={handleDeleteItem}
                        onMarkOut={canEdit ? handleMarkItemOut : undefined}
                        onAddToList={
                          canEdit ? handleAddPOItemFromSuggestion : undefined
                        }
                        accessLevel={accessLevel}
                        storeIsPublic={store?.isPublic ?? false}
                        onToggleItemVisibility={handleToggleItemVisibility}
                        isMobile={isMobile}
                        minimapExpanded={minimapExpanded}
                      />
                    )}
                  </>
                )}
              </div>
            </>
          )}

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

      {/* ── Mobile minimap (floating bottom-left) — only in the list view ── */}
      {isMobile && showCanvas && store && effectiveView === "inventory" && (
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
          blockBadges={blockBadges}
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
        <QuickAddPanel
          isOpen={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          onSubmit={handleQuickAdd}
          categories={categories}
          defaultBlockId={highlightedCell}
        />
      )}
      <RecipesPanel
        isOpen={recipesOpen}
        onClose={() => setRecipesOpen(false)}
        items={items}
        onAddMissing={canEdit ? handleAddMissingToList : undefined}
        listedNames={listedNames}
        isMobile={isMobile}
      />
      <CollectionsPanel
        isOpen={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        collections={collections}
        items={items}
        blocks={blocks}
        canEdit={canEdit}
        onCreate={handleCreateCollection}
        onRename={handleRenameCollection}
        onSetKind={handleSetCollectionKind}
        onDelete={handleDeleteCollection}
        onAddItem={handleAddCollectionItem}
        onTogglePacked={handleToggleCollectionPacked}
        onRemoveItem={handleRemoveCollectionItem}
        onCheckout={handleCheckoutCollection}
        onAddGapsToList={canEdit ? handleAddMissingToList : undefined}
        onLocate={handleJumpToItem}
        isMobile={isMobile}
      />
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

/** Map / Inventory surface toggle in the search bar. */
function SurfaceBtn({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} view`}
      aria-label={`${label} view`}
      className={`flex items-center gap-1.5 px-2.5 h-7 text-[10px] font-bold uppercase tracking-widest transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-400 hover:text-slate-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
