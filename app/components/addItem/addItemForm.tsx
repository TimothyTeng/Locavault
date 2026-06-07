import { useState, useEffect } from "react";
import { FieldLabel } from "../addstore/storeViewFinder/StoreForm";
import { runOutDays } from "~/utils/helpers/store.helper";
import {
  resolveBarcode,
  FOOD_CATEGORY_RE,
} from "~/utils/helpers/barcode.helper";
import { BarcodeScanner } from "./BarcodeScanner";

/** Format a Date as the YYYY-MM-DD value an <input type="date"> expects */
function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Category = { id: string; label: string };

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
  /** Labelled standard blocks, used as categories / shelves */
  categories?: Category[];
  selectedBlockId?: string | null;
  selectedBlockLabel?: string;
};

// Heuristics: which tracking field matters for a given category label.
// Keyword-based so it works with user-defined labels (not hardcoded names).
const EXPIRY_HINT =
  /food|grocer|pantry|fridge|freezer|perish|fresh|dairy|produce|snack|drink|beverage|fruit|veg|meat|medic|pharma|cosmetic/i;
const USERATE_HINT =
  /clean|laundry|detergent|toiletr|hygiene|paper|consumable|suppl|soap|shampoo|tissue|refill/i;

export function AddItemForm({
  onSubmit,
  categories = [],
  selectedBlockId,
  selectedBlockLabel,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [inStore, setInStore] = useState(false);
  const [nameError, setNameError] = useState(false);

  // Extended fields
  // Fallback category (a block id) used only when no block is selected on the
  // floor plan. Floor-plan selection always takes precedence.
  const [fallbackCategoryId, setFallbackCategoryId] = useState("");
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
  const [scanOpen, setScanOpen] = useState(false);
  const [looking, setLooking] = useState(false);

  // Handle a scanned/typed barcode: parse GS1 fields locally, then look up
  // the product name/category for plain retail codes.
  const handleDetect = async (raw: string) => {
    setScanOpen(false);
    setLooking(true);
    try {
      const info = await resolveBarcode(raw);
      if (info.sku) setSku(info.sku);
      if (info.expiry) {
        setExpiryDate(toDateInput(info.expiry));
        setShowExtra(true);
      }
      if (info.unit) setUnit((u) => u || info.unit!);
      if (info.name) setName((prev) => prev || info.name!);
      // Fallback auto-shelf — only when no block was picked on the floor plan
      if (!selectedBlockId && info.category === "Food") {
        const foodCat = categories.find((c) => FOOD_CATEGORY_RE.test(c.label));
        if (foodCat) setFallbackCategoryId(foodCat.id);
      }
    } finally {
      setLooking(false);
    }
  };

  // Floor-plan click wins; otherwise fall back to the chosen category shelf.
  const resolvedBlockId = selectedBlockId || fallbackCategoryId || "";

  // Which category applies, and what does it imply we should track?
  const categoryLabel = selectedBlockId
    ? (selectedBlockLabel ??
      categories.find((c) => c.id === selectedBlockId)?.label ??
      "")
    : (categories.find((c) => c.id === fallbackCategoryId)?.label ?? "");
  const focusField: "expiry" | "useRate" | null = EXPIRY_HINT.test(categoryLabel)
    ? "expiry"
    : USERATE_HINT.test(categoryLabel)
      ? "useRate"
      : null;

  // Smart quantity: refill to ~2× min stock until the user types their own
  useEffect(() => {
    if (quantityTouched) return;
    const m = Number(minQuantity);
    setQuantity(m > 0 ? m * 2 : 1);
  }, [minQuantity, quantityTouched]);

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[12px] font-mono text-slate-800 placeholder-slate-300 shadow-sm outline-none transition-all duration-150 focus:border-slate-500 focus:ring-2 focus:ring-slate-100";

  const runoutDays = runOutDays(useRate, useRatePeriod, quantity);

  const freshDays =
    expiryDate !== ""
      ? Math.ceil(
          (new Date(expiryDate).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

  const resetForm = () => {
    setName("");
    setDescription("");
    setQuantity(1);
    setQuantityTouched(false);
    setInStore(false);
    setFallbackCategoryId("");
    setSku("");
    setUnit("");
    setMinQuantity("");
    setCost("");
    setExpiryDate("");
    setUseRate("");
    setUseRatePeriod("week");
    setShowExtra(false);
  };

  // ── Reusable field blocks (so the relevant one can be promoted inline) ──

  const expiryField = (
    <div className="flex flex-col gap-2">
      <FieldLabel>Expiry Date</FieldLabel>
      <input
        type="date"
        value={expiryDate}
        onChange={(e) => setExpiryDate(e.target.value)}
        className={inputClass}
      />
      {freshDays != null && (
        <p className="text-[10px] font-mono text-slate-400">
          {freshDays >= 0
            ? `≈ fresh for ${freshDays} day${freshDays !== 1 ? "s" : ""}`
            : "⚠ already past expiry"}
        </p>
      )}
    </div>
  );

  const useRateField = (
    <div className="flex flex-col gap-2">
      <FieldLabel>Use Rate</FieldLabel>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          value={useRate}
          placeholder="amount"
          onChange={(e) => setUseRate(e.target.value)}
          className={inputClass}
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
  );

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
          selectedBlockId: resolvedBlockId || null,
          sku: sku || null,
          unit: unit || null,
          minQuantity: minQuantity !== "" ? Number(minQuantity) : null,
          cost: cost !== "" ? Math.round(Number(cost) * 100) : null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          useRate: useRate !== "" ? Number(useRate) : null,
          useRatePeriod: useRate !== "" ? useRatePeriod : null,
        });
        resetForm();
      }}
      className="flex flex-col gap-6"
    >
      {/* Scan barcode */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md border border-slate-800 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M21 5v14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Scan barcode
        </button>
        {looking && (
          <p className="text-[10px] font-mono text-slate-400 text-center">
            Looking up product…
          </p>
        )}
      </div>

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

      {/* Assignment — floor-plan click is primary, category is the fallback */}
      {selectedBlockId ? (
        <div className="flex flex-col gap-2">
          <FieldLabel>Block</FieldLabel>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-mono text-slate-600">
            {selectedBlockLabel || selectedBlockId}
          </div>
          <p className="text-[10px] font-mono text-slate-400">
            Assigned from the floor plan. Click another block to change.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <FieldLabel>Category</FieldLabel>
          {categories.length > 0 ? (
            <select
              value={fallbackCategoryId}
              onChange={(e) => setFallbackCategoryId(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">Unassigned</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-mono text-slate-300">
              Click a block on the floor plan to assign, or label blocks to use
              them as categories
            </div>
          )}
          <p className="text-[10px] font-mono text-slate-400">
            No block selected — pick a category to auto-shelf the item.
          </p>
        </div>
      )}

      {/* Quantity + Unit */}
      <div className="flex gap-3">
        <div className="flex flex-col gap-2 flex-1">
          <FieldLabel>Quantity</FieldLabel>
          <input
            type="number"
            value={quantity}
            min={0}
            onChange={(e) => {
              setQuantity(Number(e.target.value));
              setQuantityTouched(true);
            }}
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

      {/* Min stock (drives low-stock flag + suggested quantity) */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Min Stock</FieldLabel>
        <input
          type="number"
          min="0"
          value={minQuantity}
          placeholder="low-stock threshold"
          onChange={(e) => setMinQuantity(e.target.value)}
          className={inputClass}
        />
        <p className="text-[10px] font-mono text-slate-400">
          Flags the item as low and seeds a sensible starting quantity.
        </p>
      </div>

      {/* Promoted tracking field, based on the category */}
      {focusField && (
        <div className="flex flex-col gap-2 rounded-md bg-amber-50/50 border border-amber-100 p-3">
          <p className="text-[10px] font-mono text-amber-700">
            {focusField === "expiry"
              ? `“${categoryLabel}” items: add an expiry date to track freshness.`
              : `“${categoryLabel}” items: add a use rate to predict run-out.`}
          </p>
          {focusField === "expiry" ? expiryField : useRateField}
        </div>
      )}

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

          {/* Expiry — shown here only if not already promoted above */}
          {focusField !== "expiry" && expiryField}

          {/* Use rate — shown here only if not already promoted above */}
          {focusField !== "useRate" && useRateField}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm transition-all duration-150 hover:bg-slate-800 hover:text-white hover:border-slate-800"
      >
        Add Item
      </button>

      {scanOpen && (
        <BarcodeScanner
          onDetect={handleDetect}
          onClose={() => setScanOpen(false)}
        />
      )}
    </form>
  );
}
