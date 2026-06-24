import { useEffect } from "react";
import type { PurchaseOrderItem } from "~/types/purchaseOrderTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
import type { BarcodeInfo } from "~/utils/helpers/barcode.helper";
import { PurchaseOrderList } from "./purchaseOrderList";
import type { Item } from "~/types/storeTypes";
import { CloseButton } from "~/components/common/CloseButton";

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
  onDelete: (id: string) => void;
  onBuy: (id: string) => void;
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
  onDelete,
  onBuy,
  isMobile = false,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const header = (
    <div className="flex items-center justify-between px-4 md:px-6 h-12 md:h-14 border-b border-slate-200 shrink-0">
      <div className="flex items-center gap-2">
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
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-800">
          Shopping List
        </span>
        {items.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">
            {items.length}
          </span>
        )}
      </div>
      <CloseButton onClick={onClose} />
    </div>
  );

  if (isMobile) {
    return (
      <div
        className={[
          "fixed top-10 left-0 right-0 z-20",
          "h-[calc(57vh-7rem)] bg-white border-b border-slate-200 shadow-2xl",
          "flex flex-col transition-transform duration-300 ease-out",
          isOpen
            ? "translate-y-0"
            : "-translate-y-full invisible pointer-events-none",
        ].join(" ")}
      >
        {header}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
            onDelete={onDelete}
            onBuy={onBuy}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "absolute inset-y-0 right-11 z-30 w-1/2 max-w-md",
        "bg-white border-l border-slate-200 shadow-2xl",
        "flex flex-col transition-transform duration-300 ease-out",
        isOpen ? "translate-x-0" : "translate-x-[calc(100%_+_3rem)]",
      ].join(" ")}
    >
      {header}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
          onDelete={onDelete}
          onBuy={onBuy}
        />
      </div>
    </div>
  );
}
