import { useState, useEffect } from "react";
import type { Item } from "./storeTable";

type Props = {
  item: Item | null;
  onClose: () => void;
  onSave: (updated: Item) => void;
};

export function ItemEditModal({ item, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQuantity(item.quantity);
      setDescription(item.description ?? "");
    }
  }, [item]);

  if (!item) return null;

  const inputClass =
    "w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-mono text-slate-800 placeholder-slate-300 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 transition-all";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Edit Item
          </span>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-slate-600 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Quantity
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...item, name, quantity, description })}
            className="px-4 py-2 rounded-md bg-slate-800 border border-slate-800 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-slate-700 transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
