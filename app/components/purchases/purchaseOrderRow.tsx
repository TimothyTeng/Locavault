import { useEffect, useState } from "react";
import type { PurchaseOrderItem } from "~/types/purchaseOrderTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
import type { ItemType } from "~/types/itemTypeTypes";
import { ITEM_TYPES, TYPE_META } from "~/lib/itemTypes";
import { PurchaseOrderOptionalFields } from "./purchaseOrderOptionalFields";

type Props = {
  item: PurchaseOrderItem;
  blocks: BlocksMap;
  checked: boolean;
  onToggleChecked: (id: string) => void;
  onUpdate: (updated: PurchaseOrderItem) => void;
  /** Run best-guess inference once a fresh row gets a real name. */
  onInfer: (row: PurchaseOrderItem) => void;
  onDelete: (id: string) => void;
  onBuy: (id: string) => void;
};

export function PurchaseOrderRow({
  item,
  blocks,
  checked,
  onToggleChecked,
  onUpdate,
  onInfer,
  onDelete,
  onBuy,
}: Props) {
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit ?? "");
  // Flashes the location chip when the user tries to buy a row with no location.
  const [flashLoc, setFlashLoc] = useState(false);

  useEffect(() => setUnit(item.unit ?? ""), [item.unit]);
  useEffect(() => {
    if (item.blockId) setFlashLoc(false);
  }, [item.blockId]);

  // Standard (placeable) blocks — the only valid locations.
  const blockOptions = Object.entries(blocks).filter(
    ([, b]) => b.kind === "standard" || b.kind === undefined,
  );

  // A real, named row (not the blank "New item" placeholder) shows its metadata.
  const named = !!item.name && item.name !== "New item";
  // Still at creation defaults → safe to auto-infer on the first name commit.
  const atDefaults = item.itemType === "other" && !item.blockId && !item.unit;

  const flush = () => {
    const nextName = name.trim() || item.name;
    const nextQty = Number(qty) || item.quantity;
    const changed = nextName !== item.name || nextQty !== item.quantity;
    if (atDefaults && nextName && nextName !== "New item") {
      // First real name → infer type/location/unit (and link) for confirming.
      onInfer({ ...item, name: nextName, quantity: nextQty });
    } else if (changed) {
      onUpdate({ ...item, name: nextName, quantity: nextQty });
    }
  };

  // Apply a metadata change, carrying the current (possibly-edited) name/qty.
  const patch = (fields: Partial<PurchaseOrderItem>) =>
    onUpdate({
      ...item,
      name: name.trim() || item.name,
      quantity: Number(qty) || item.quantity,
      ...fields,
    });

  const handleBuy = () => {
    if (!item.blockId) {
      // Buy-time safety net: a row must have a home before it joins inventory.
      setFlashLoc(true);
      return;
    }
    onBuy(item.id);
  };

  const input =
    "w-full px-2 py-1 text-[11px] font-mono border border-transparent rounded focus:outline-none focus:border-slate-300 bg-transparent hover:border-slate-200 transition-colors";
  const chip =
    "px-1.5 py-0.5 text-[10px] font-mono rounded border bg-white cursor-pointer focus:outline-none transition-colors";

  return (
    <>
      <tr
        className={`group transition-colors ${named ? "" : "border-b border-slate-100"} ${
          checked ? "bg-emerald-50/40" : "hover:bg-slate-50/50"
        }`}
      >
        {/* "Got it" toggle */}
        <td className="w-8 pl-3 py-2 align-top">
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
        <td className="py-1 pr-1 min-w-[140px] align-top">
          <input
            className={`${input} ${checked ? "line-through text-slate-400" : ""}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={flush}
            placeholder="Item name"
          />
        </td>

        {/* Qty */}
        <td className="py-1 pr-1 w-20 align-top">
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
        <td className="py-1 pr-2 w-20 align-top">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* More optional fields (cost, min stock, expiry, use-rate…) */}
            <button
              onClick={() => setOptionalOpen(true)}
              className="w-5 h-5 rounded border border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600 flex items-center justify-center text-[9px] font-bold transition-colors"
              title="More details"
            >
              +
            </button>

            {/* Quick buy — commit this one row to inventory now */}
            <button
              onClick={handleBuy}
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

      {/* Inferred metadata — shown pre-filled and editable in place (no modal,
          no extra confirm tap). Every named row carries a type + a location. */}
      {named && (
        <tr className="border-b border-slate-100">
          <td />
          <td colSpan={3} className="pb-2 pr-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Type */}
              <select
                value={item.itemType}
                onChange={(e) =>
                  patch({ itemType: e.target.value as ItemType })
                }
                className={`${chip} border-slate-200 text-slate-600 hover:border-slate-300`}
                title="Item type"
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_META[t].label}
                  </option>
                ))}
              </select>

              {/* Location — required; flashes if a buy is attempted without one */}
              <select
                value={item.blockId ?? ""}
                onChange={(e) => patch({ blockId: e.target.value || null })}
                className={`${chip} ${
                  item.blockId
                    ? "border-slate-200 text-slate-600 hover:border-slate-300"
                    : flashLoc
                      ? "border-red-400 text-red-600 ring-1 ring-red-300"
                      : "border-amber-300 text-amber-700"
                }`}
                title="Location — where it'll be shelved"
              >
                <option value="">📍 Set location</option>
                {blockOptions.map(([id, b]) => (
                  <option key={id} value={id}>
                    📍 {b.label || "Unlabelled block"}
                  </option>
                ))}
              </select>

              {/* Unit */}
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                onBlur={() => {
                  const next = unit.trim() || null;
                  if (next !== (item.unit ?? null)) patch({ unit: next });
                }}
                placeholder="unit"
                className={`${chip} border-slate-200 text-slate-600 w-16 hover:border-slate-300`}
                title="Unit (e.g. kg, l, box)"
              />

              {/* Pack size — display-only "what it comes in" */}
              {item.packageSize && (
                <span
                  className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-slate-100 bg-slate-50 text-slate-500"
                  title="Pack size"
                >
                  📦 {item.packageSize}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}

      {optionalOpen && (
        <PurchaseOrderOptionalFields
          item={item}
          blocks={blocks}
          onSave={(fields) => onUpdate({ ...item, ...fields })}
          onClose={() => setOptionalOpen(false)}
        />
      )}
    </>
  );
}
