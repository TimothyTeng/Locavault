import { useState } from "react";
import type { PurchaseOrderItem } from "~/types/purchaseOrderTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
import { PurchaseOrderOptionalFields } from "./purchaseOrderOptionalFields";

type Props = {
  item: PurchaseOrderItem;
  blocks: BlocksMap;
  checked: boolean;
  onToggleChecked: (id: string) => void;
  onUpdate: (updated: PurchaseOrderItem) => void;
  onDelete: (id: string) => void;
  onBuy: (id: string) => void;
};

export function PurchaseOrderRow({
  item,
  blocks,
  checked,
  onToggleChecked,
  onUpdate,
  onDelete,
  onBuy,
}: Props) {
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(String(item.quantity));

  const hasOptional =
    item.description ||
    item.sku ||
    item.unit ||
    item.minQuantity != null ||
    item.cost != null ||
    item.expiryDate ||
    item.useRate != null ||
    item.blockId;

  const flush = () => {
    const updated: PurchaseOrderItem = {
      ...item,
      name: name || item.name,
      quantity: Number(qty) || item.quantity,
    };
    if (updated.name !== item.name || updated.quantity !== item.quantity) {
      onUpdate(updated);
    }
  };

  const handleOptionalSave = (fields: Partial<PurchaseOrderItem>) => {
    onUpdate({
      ...item,
      name,
      quantity: Number(qty) || item.quantity,
      ...fields,
    });
  };

  const input =
    "w-full px-2 py-1 text-[11px] font-mono border border-transparent rounded focus:outline-none focus:border-slate-300 bg-transparent hover:border-slate-200 transition-colors";

  return (
    <>
      <tr
        className={`border-b border-slate-100 group transition-colors ${
          checked ? "bg-emerald-50/40" : "hover:bg-slate-50/50"
        }`}
      >
        {/* "Got it" toggle */}
        <td className="w-8 pl-3 py-2">
          <button
            onClick={() => onToggleChecked(item.id)}
            className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${
              checked
                ? "border-emerald-400 bg-emerald-400 text-white"
                : "border-slate-300 hover:border-emerald-400 hover:bg-emerald-50"
            }`}
            title={checked ? "Got it — tap to uncheck" : "Mark as got it"}
          >
            {checked && (
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6l3 3 5-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </td>

        {/* Name */}
        <td className="py-1 pr-1 min-w-[140px]">
          <input
            className={`${input} ${checked ? "line-through text-slate-400" : ""}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={flush}
            placeholder="Item name"
          />
        </td>

        {/* Qty */}
        <td className="py-1 pr-1 w-20">
          <input
            type="number"
            className={`${input} ${checked ? "text-slate-400" : ""}`}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={flush}
            placeholder="1"
          />
        </td>

        {/* Actions */}
        <td className="py-1 pr-2 w-20">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Optional fields */}
            <button
              onClick={() => setOptionalOpen(true)}
              className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-colors ${
                hasOptional
                  ? "bg-slate-200 text-slate-700"
                  : "border border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600"
              }`}
              title="Optional details"
            >
              +
            </button>

            {/* Quick buy — commit this one row to inventory now */}
            <button
              onClick={() => onBuy(item.id)}
              className="w-5 h-5 rounded border border-transparent text-slate-300 hover:border-emerald-200 hover:text-emerald-600 flex items-center justify-center transition-colors"
              title="Buy now — adds to inventory immediately"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 6h18M16 10a4 4 0 01-8 0"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Delete */}
            <button
              onClick={() => onDelete(item.id)}
              className="w-5 h-5 rounded border border-transparent text-slate-300 hover:border-red-200 hover:text-red-500 flex items-center justify-center transition-colors"
              title="Remove"
            >
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                <path
                  d="M1 1l8 8M9 1L1 9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </td>
      </tr>

      {optionalOpen && (
        <PurchaseOrderOptionalFields
          item={item}
          blocks={blocks}
          onSave={handleOptionalSave}
          onClose={() => setOptionalOpen(false)}
        />
      )}
    </>
  );
}
