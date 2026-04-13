import { useState } from "react";
import { FieldLabel } from "../addstore/storeViewFinder/StoreForm";
import { runOutDays } from "~/utils/helpers/store.helper";

type Props = {
  onSubmit: (data: {
    name: string;
    description: string;
    quantity: number;
    inStore: boolean;
    selectedBlockId?: string | null;
    sku?: string | null;
    unit?: string | null;
    minQuantity?: number | null;
    cost?: number | null;
    expiryDate?: Date | null;
    useRate?: number | null;
    useRatePeriod?: "day" | "week" | "month" | null;
  }) => void;
  selectedBlockId?: string | null;
  selectedBlockLabel?: string;
};

export function AddItemForm({
  onSubmit,
  selectedBlockId,
  selectedBlockLabel,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [inStore, setInStore] = useState(false);
  const [nameError, setNameError] = useState(false);

  // Extended fields
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [useRate, setUseRate] = useState("");
  const [useRatePeriod, setUseRatePeriod] = useState<"day" | "week" | "month">(
    "week",
  );
  const [showExtra, setShowExtra] = useState(false);

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[12px] font-mono text-slate-800 placeholder-slate-300 shadow-sm outline-none transition-all duration-150 focus:border-slate-500 focus:ring-2 focus:ring-slate-100";

  const runoutDays = runOutDays(useRate, useRatePeriod, quantity);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setNameError(true);
          return;
        }
        setNameError(false);
        onSubmit({
          name,
          description,
          quantity,
          inStore,
          selectedBlockId,
          sku: sku || null,
          unit: unit || null,
          minQuantity: minQuantity !== "" ? Number(minQuantity) : null,
          cost: cost !== "" ? Math.round(Number(cost) * 100) : null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          useRate: useRate !== "" ? Number(useRate) : null,
          useRatePeriod: useRate !== "" ? useRatePeriod : null,
        });
        // Reset form
        setName("");
        setDescription("");
        setQuantity(0);
        setInStore(false);
        setSku("");
        setUnit("");
        setMinQuantity("");
        setCost("");
        setExpiryDate("");
        setUseRate("");
        setUseRatePeriod("week");
        setShowExtra(false);
      }}
      className="flex flex-col gap-6"
    >
      {/* Name */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Item Name</FieldLabel>
        <input
          type="text"
          value={name}
          maxLength={60}
          placeholder="e.g. Box of Screws"
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(false);
          }}
          className={`${inputClass} ${nameError ? "border-red-400 ring-2 ring-red-100" : ""}`}
        />
        {nameError && (
          <p className="text-[10px] text-red-500 font-medium mt-0.5">
            Item name is required.
          </p>
        )}
      </div>

      {/* Quantity + Unit */}
      <div className="flex gap-3">
        <div className="flex flex-col gap-2 flex-1">
          <FieldLabel>Quantity</FieldLabel>
          <input
            type="number"
            value={quantity}
            min={0}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2 w-28">
          <FieldLabel>Unit</FieldLabel>
          <input
            type="text"
            value={unit}
            placeholder="kg, pcs…"
            onChange={(e) => setUnit(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Description</FieldLabel>
        <textarea
          value={description}
          placeholder="Describe this item..."
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[11px] font-mono text-slate-800 placeholder-slate-300 shadow-sm outline-none transition-all duration-150 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 leading-relaxed"
        />
      </div>

      {/* In Store */}
      <div className="flex flex-col gap-2">
        <FieldLabel>In Store</FieldLabel>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setInStore((prev) => !prev)}
            className={[
              "relative w-10 h-5 rounded-full border transition-all duration-200",
              inStore
                ? "bg-slate-800 border-slate-800"
                : "bg-white border-slate-300",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200",
                inStore ? "left-[calc(100%-18px)]" : "left-0.5",
              ].join(" ")}
            />
          </button>
          <span className="text-[11px] font-mono text-slate-500">
            {inStore ? "Currently in store" : "Not in store"}
          </span>
        </div>
      </div>

      {/* Block */}
      {selectedBlockId ? (
        <div className="flex flex-col gap-2">
          <FieldLabel>Block</FieldLabel>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-mono text-slate-600">
            {selectedBlockLabel || selectedBlockId}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <FieldLabel>Block</FieldLabel>
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-mono text-slate-300">
            Click a block on the floor plan to assign
          </div>
        </div>
      )}

      {/* Additional details toggle */}
      <button
        type="button"
        onClick={() => setShowExtra((v) => !v)}
        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors self-start"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`transition-transform duration-150 ${showExtra ? "rotate-90" : ""}`}
        >
          <path
            d="M3 2l4 3-4 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {showExtra ? "Hide" : "Show"} additional details
      </button>

      {showExtra && (
        <div className="flex flex-col gap-5 pl-3 border-l-2 border-slate-100">
          {/* SKU + Cost */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-2 flex-1">
              <FieldLabel>SKU / Barcode</FieldLabel>
              <input
                type="text"
                value={sku}
                placeholder="optional"
                onChange={(e) => setSku(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2 w-32">
              <FieldLabel>Cost (per unit)</FieldLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 font-mono">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  placeholder="0.00"
                  onChange={(e) => setCost(e.target.value)}
                  className={`${inputClass} pl-6`}
                />
              </div>
            </div>
          </div>

          {/* Min stock + Expiry */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-2 flex-1">
              <FieldLabel>Min Stock</FieldLabel>
              <input
                type="number"
                min="0"
                value={minQuantity}
                placeholder="low-stock threshold"
                onChange={(e) => setMinQuantity(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <FieldLabel>Expiry Date</FieldLabel>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Use rate */}
          <div className="flex flex-col gap-2">
            <FieldLabel>Use Rate</FieldLabel>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={useRate}
                placeholder="amount"
                onChange={(e) => setUseRate(e.target.value)}
                className={`${inputClass}`}
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
            {runoutDays != null && (
              <p className="text-[10px] font-mono text-slate-400">
                ≈ runs out in {runoutDays} day{runoutDays !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm transition-all duration-150 hover:bg-slate-800 hover:text-white hover:border-slate-800"
      >
        Add Item
      </button>
    </form>
  );
}
