import { useState, useEffect } from "react";
import type { Item } from "#types/storeTypes";

type Props = {
  item: Item | null;
  onClose: () => void;
  onSave: (updated: Item) => void;
};

export function ItemEditModal({ item, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [cost, setCost] = useState(""); // displayed as dollars
  const [expiryDate, setExpiryDate] = useState(""); // YYYY-MM-DD string
  const [useRate, setUseRate] = useState("");
  const [useRatePeriod, setUseRatePeriod] = useState<"day" | "week" | "month">(
    "week",
  );

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQuantity(item.quantity);
      setDescription(item.description ?? "");
      setSku(item.sku ?? "");
      setUnit(item.unit ?? "");
      setMinQuantity(item.minQuantity != null ? String(item.minQuantity) : "");
      setCost(item.cost != null ? (item.cost / 100).toFixed(2) : "");
      setExpiryDate(
        item.expiryDate
          ? new Date(item.expiryDate).toISOString().split("T")[0]
          : "",
      );
      setUseRate(item.useRate != null ? String(item.useRate) : "");
      setUseRatePeriod(item.useRatePeriod ?? "week");
    }
  }, [item]);

  if (!item) return null;

  const handleSave = () => {
    onSave({
      ...item,
      name,
      quantity,
      description,
      sku: sku || null,
      unit: unit || null,
      minQuantity: minQuantity !== "" ? Number(minQuantity) : null,
      cost: cost !== "" ? Math.round(Number(cost) * 100) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      useRate: useRate !== "" ? Number(useRate) : null,
      useRatePeriod: useRate !== "" ? useRatePeriod : null,
    });
  };

  const inputClass =
    "w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-mono text-slate-800 placeholder-slate-300 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 transition-all";

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
      {children}
    </label>
  );

  const Field = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
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

        {/* ── Core fields ── */}
        <div className="flex flex-col gap-4">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Unit">
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="kg, box, pcs…"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </Field>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-slate-100 pt-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
            Additional Details
          </span>
        </div>

        {/* ── Extended fields ── */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU / Barcode">
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="optional"
                className={inputClass}
              />
            </Field>
            <Field label="Cost (per unit)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-mono">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                  className={`${inputClass} pl-6`}
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Min Stock">
              <input
                type="number"
                min="0"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="low-stock threshold"
                className={inputClass}
              />
            </Field>
            <Field label="Expiry Date">
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Use rate */}
          <div className="flex flex-col gap-1.5">
            <Label>Use Rate</Label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={useRate}
                onChange={(e) => setUseRate(e.target.value)}
                placeholder="amount"
                className={`${inputClass} flex-1`}
              />
              <select
                value={useRatePeriod}
                onChange={(e) =>
                  setUseRatePeriod(e.target.value as "day" | "week" | "month")
                }
                className={`${inputClass} w-28 cursor-pointer`}
              >
                <option value="day">/ day</option>
                <option value="week">/ week</option>
                <option value="month">/ month</option>
              </select>
            </div>
            {useRate && (
              <p className="text-[9px] text-slate-400 font-mono">
                ≈ runs out in{" "}
                {Math.floor(
                  quantity /
                    (Number(useRate) /
                      (useRatePeriod === "day"
                        ? 1
                        : useRatePeriod === "week"
                          ? 7
                          : 30)),
                )}{" "}
                days
              </p>
            )}
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
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-slate-800 border border-slate-800 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-slate-700 transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
