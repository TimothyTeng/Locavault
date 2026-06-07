import { createPortal } from "react-dom";
import { useState } from "react";
import type { PurchaseOrderItem } from "~/types/purchaseOrderTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";

type Props = {
  item: PurchaseOrderItem;
  blocks: BlocksMap;
  onSave: (fields: Partial<PurchaseOrderItem>) => void;
  onClose: () => void;
};

export function PurchaseOrderOptionalFields({
  item,
  blocks,
  onSave,
  onClose,
}: Props) {
  const [fields, setFields] = useState({
    description: item.description ?? "",
    sku: item.sku ?? "",
    unit: item.unit ?? "",
    minQuantity: item.minQuantity ?? "",
    cost: item.cost != null ? (item.cost / 100).toFixed(2) : "",
    expiryDate: item.expiryDate
      ? new Date(item.expiryDate).toISOString().split("T")[0]
      : "",
    useRate: item.useRate ?? "",
    useRatePeriod: item.useRatePeriod ?? "week",
    blockId: item.blockId ?? "",
  });

  const set = (k: string, v: string) => setFields((p) => ({ ...p, [k]: v }));

  // Standard blocks only — these are the placeable locations
  const blockOptions = Object.entries(blocks).filter(
    ([, b]) => b.kind === "standard" || b.kind === undefined,
  );

  const handleSave = () => {
    onSave({
      description: fields.description || null,
      sku: fields.sku || null,
      unit: fields.unit || null,
      minQuantity:
        fields.minQuantity !== "" ? Number(fields.minQuantity) : null,
      cost: fields.cost !== "" ? Math.round(Number(fields.cost) * 100) : null,
      expiryDate: fields.expiryDate ? new Date(fields.expiryDate) : null,
      useRate: fields.useRate !== "" ? Number(fields.useRate) : null,
      useRatePeriod: (fields.useRatePeriod as "day" | "week" | "month") || null,
      blockId: fields.blockId || null,
    });
    onClose();
  };

  const input =
    "w-full px-2 py-1.5 text-[11px] font-mono border border-slate-200 rounded-md focus:outline-none focus:border-slate-400 bg-white";
  const label =
    "text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 block";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl border border-slate-200 shadow-2xl w-80 flex flex-col z-10">
        <div className="flex items-center justify-between px-4 h-12 border-b border-slate-100 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">
            Optional Details
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all"
          >
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path
                d="M1 1l8 8M9 1L1 9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-3 overflow-y-auto max-h-[60vh]">
          <div>
            <label className={label}>Description</label>
            <textarea
              value={fields.description}
              onChange={(e) => set("description", e.target.value)}
              className={`${input} resize-none h-16`}
              placeholder="Optional notes"
            />
          </div>
          <div>
            <label className={label}>Location</label>
            <select
              className={input}
              value={fields.blockId}
              onChange={(e) => set("blockId", e.target.value)}
            >
              <option value="">No location</option>
              {blockOptions.map(([id, b]) => (
                <option key={id} value={id}>
                  {b.label || "Unlabelled block"}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>SKU</label>
              <input
                className={input}
                value={fields.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="e.g. ABC-001"
              />
            </div>
            <div>
              <label className={label}>Unit</label>
              <input
                className={input}
                value={fields.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="e.g. kg, box"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Min Stock</label>
              <input
                type="number"
                className={input}
                value={fields.minQuantity}
                onChange={(e) => set("minQuantity", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={label}>Cost ($)</label>
              <input
                type="number"
                step="0.01"
                className={input}
                value={fields.cost}
                onChange={(e) => set("cost", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className={label}>Expiry Date</label>
            <input
              type="date"
              className={input}
              value={fields.expiryDate}
              onChange={(e) => set("expiryDate", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Use Rate</label>
              <input
                type="number"
                className={input}
                value={fields.useRate}
                onChange={(e) => set("useRate", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={label}>Per</label>
              <select
                className={input}
                value={fields.useRatePeriod}
                onChange={(e) => set("useRatePeriod", e.target.value)}
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 shrink-0">
          <button
            onClick={handleSave}
            className="w-full py-2 rounded-md bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
