import { useState } from "react";
import type { Item } from "~/types/storeTypes";
import type { PurchaseOrderItem } from "~/types/purchaseOrderTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
import {
  resolveBarcode,
  type BarcodeInfo,
} from "~/utils/helpers/barcode.helper";
import { PurchaseOrderRow } from "./purchaseOrderRow";
import { PurchaseOrderSuggestions } from "./purchaseOrderSuggestions";
import { BarcodeScanner } from "../addItem/BarcodeScanner";

type Props = {
  items: PurchaseOrderItem[];
  blocks: BlocksMap;
  storeItems: Item[];
  checkedIds: Set<string>;
  onToggleChecked: (id: string) => void;
  onCommitChecked: () => void;
  onAdd: () => void;
  onAddScanned: (info: BarcodeInfo) => void;
  onAddFromSuggestion: (item: Item) => void;
  onAddAll: (items: Item[]) => void;
  onUpdate: (item: PurchaseOrderItem) => void;
  onInfer: (item: PurchaseOrderItem) => void;
  onDelete: (id: string) => void;
  onBuy: (id: string) => void;
};

export function PurchaseOrderList({
  items,
  blocks,
  storeItems,
  checkedIds,
  onToggleChecked,
  onCommitChecked,
  onAdd,
  onAddScanned,
  onAddFromSuggestion,
  onAddAll,
  onUpdate,
  onInfer,
  onDelete,
  onBuy,
}: Props) {
  const [scanOpen, setScanOpen] = useState(false);
  const [looking, setLooking] = useState(false);

  const handleScan = async (raw: string) => {
    setScanOpen(false);
    setLooking(true);
    try {
      const info = await resolveBarcode(raw);
      onAddScanned(info);
    } finally {
      setLooking(false);
    }
  };
  const existingItemIds = new Set(
    items.map((i) => i.itemId).filter((id): id is string => id != null),
  );
  const existingNames = new Set(items.map((i) => i.name));
  const checkedCount = items.filter((i) => checkedIds.has(i.id)).length;

  return (
    <div className="flex flex-col h-full">
      {/* Needs restocking (inline) */}
      <PurchaseOrderSuggestions
        items={storeItems}
        existingItemIds={existingItemIds}
        existingNames={existingNames}
        onAdd={onAddFromSuggestion}
        onAddAll={onAddAll}
      />

      {/* Your list */}
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 6h18M16 10a4 4 0 01-8 0"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[11px] font-mono">Your list is empty</span>
          <span className="text-[10px] font-mono text-slate-300">
            Add what's low above, or add an item below
          </span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="w-8 pl-3 py-2" />
                <th className="py-2 pr-1 text-left text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  Name
                </th>
                <th className="py-2 pr-1 w-20 text-left text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  Qty
                </th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <PurchaseOrderRow
                  key={item.id}
                  item={item}
                  blocks={blocks}
                  checked={checkedIds.has(item.id)}
                  onToggleChecked={onToggleChecked}
                  onUpdate={onUpdate}
                  onInfer={onInfer}
                  onDelete={onDelete}
                  onBuy={onBuy}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer: Add item + commit bar */}
      <div className="shrink-0 px-4 py-3 border-t border-slate-100 flex flex-col gap-2">
        {checkedCount > 0 && (
          <button
            onClick={onCommitChecked}
            className="w-full py-2 rounded-md bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Add {checkedCount} to inventory
          </button>
        )}

        <div className="flex gap-2">
          <button
            onClick={onAdd}
            className="flex items-center justify-center gap-2 flex-1 py-2 px-3 rounded-md border border-dashed border-slate-300 text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1v10M1 6h10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            Add item
          </button>
          <button
            onClick={() => setScanOpen(true)}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-md border border-slate-800 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-colors"
            title="Scan a barcode to add"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M21 5v14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Scan
          </button>
        </div>
        {looking && (
          <p className="text-[10px] font-mono text-slate-400 text-center">
            Looking up product…
          </p>
        )}
      </div>

      {scanOpen && (
        <BarcodeScanner
          onDetect={handleScan}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}
