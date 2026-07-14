import { useMemo, useState } from "react";
import type { PurchaseOrderItem } from "~/types/purchaseOrderTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
import type { BarcodeInfo } from "~/utils/helpers/barcode.helper";
import type { MealNeed } from "~/types/recipeTypes";
import { PurchaseOrderList } from "./purchaseOrderList";
import { PurchaseOrderUpcoming } from "./purchaseOrderUpcoming";
import type { Item } from "~/types/storeTypes";
import { SidePanel } from "~/components/common/SidePanel";
import { SegmentedTabs } from "~/components/common/SegmentedTabs";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  items: PurchaseOrderItem[];
  blocks: BlocksMap;
  storeItems: Item[];
  checkedIds: Set<string>;
  onToggleChecked: (id: string) => void;
  onCommitChecked: () => void;
  onAddFromSuggestion: (item: Item) => void;
  onAddAll: (items: Item[]) => void;
  onAdd: () => void;
  onAddScanned: (info: BarcodeInfo) => void;
  onUpdate: (item: PurchaseOrderItem) => void;
  /** Fill in best-guess metadata once a fresh row gets a real name. */
  onInfer: (item: PurchaseOrderItem) => void;
  onDelete: (id: string) => void;
  onBuy: (id: string) => void;
  /** Enter full-screen shopping mode. */
  onStartShopping?: () => void;
  /** Per-meal upcoming needs — powers the "Upcoming" tab. */
  mealNeeds?: MealNeed[];
  onAddNames?: (names: string[]) => void;
  /** Block label an Upcoming ingredient would be shelved to (the hint). */
  destinationFor?: (name: string) => string | null;
  isMobile?: boolean;
};

export function PurchaseOrderPanel({
  isOpen,
  onClose,
  items,
  blocks,
  storeItems,
  checkedIds,
  onToggleChecked,
  onCommitChecked,
  onAddFromSuggestion,
  onAddAll,
  onAdd,
  onAddScanned,
  onUpdate,
  onInfer,
  onDelete,
  onBuy,
  onStartShopping,
  mealNeeds = [],
  onAddNames,
  destinationFor,
  isMobile = false,
}: Props) {
  const [tab, setTab] = useState<"list" | "upcoming">("list");

  // Distinct ingredients upcoming meals need but the store + list don't cover —
  // the "Upcoming" tab badge.
  const existingLower = useMemo(
    () => new Set(items.map((i) => i.name.toLowerCase())),
    [items],
  );
  const upcomingBadge = useMemo(() => {
    const s = new Set<string>();
    for (const need of mealNeeds)
      for (const name of need.names)
        if (!existingLower.has(name.toLowerCase())) s.add(name.toLowerCase());
    return s.size;
  }, [mealNeeds, existingLower]);

  const showUpcoming = !!onAddNames;
  const activeTab = tab === "upcoming" && showUpcoming ? "upcoming" : "list";

  const icon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 6h18M16 10a4 4 0 01-8 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const tabBar = showUpcoming ? (
    <SegmentedTabs<"list" | "upcoming">
      ariaLabel="Shopping list view"
      variant="underline"
      className="shrink-0 border-b border-slate-200"
      value={activeTab}
      onChange={setTab}
      tabs={[
        { id: "list", label: "List", badge: items.length },
        {
          id: "upcoming",
          label: "Upcoming",
          badge: upcomingBadge,
          badgeClassName:
            "px-1.5 py-0.5 rounded-full text-[9px] bg-indigo-100 text-indigo-700",
        },
      ]}
    />
  ) : null;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      isMobile={isMobile}
      mobileVariant="sheet"
      ariaLabel="Shopping List"
      title="Shopping List"
      icon={icon}
      belowHeader={tabBar}
    >
      {activeTab === "upcoming" && onAddNames ? (
        <PurchaseOrderUpcoming
          mealNeeds={mealNeeds}
          existingNames={existingLower}
          onAdd={onAddNames}
          destinationFor={destinationFor}
        />
      ) : (
        <PurchaseOrderList
          items={items}
          blocks={blocks}
          storeItems={storeItems}
          checkedIds={checkedIds}
          onToggleChecked={onToggleChecked}
          onCommitChecked={onCommitChecked}
          onAdd={onAdd}
          onAddScanned={onAddScanned}
          onAddFromSuggestion={onAddFromSuggestion}
          onAddAll={onAddAll}
          onUpdate={onUpdate}
          onInfer={onInfer}
          onDelete={onDelete}
          onBuy={onBuy}
          onStartShopping={onStartShopping}
        />
      )}
    </SidePanel>
  );
}
