import { useState, useEffect, useRef } from "react";
import { FieldLabel } from "../addstore/storeViewFinder/StoreForm";
import { runOutDays } from "~/utils/helpers/store.helper";
import { UNIT_OPTIONS } from "~/utils/helpers/units";
import {
  resolveBarcode,
  FOOD_CATEGORY_RE,
} from "~/utils/helpers/barcode.helper";
import {
  DEFAULT_ITEM_TYPE,
  fieldsForType,
  inferTypeFromLabel,
  ITEM_TYPES,
  TYPE_META,
  type ItemType,
} from "~/lib/itemTypes";
import { inferItemFields } from "~/utils/helpers/poInference.helper";
import type { Item } from "~/types/storeTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
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
    selectedBlockId?: string | null;
    itemType: ItemType;
    sku?: string | null;
    unit?: string | null;
    minQuantity?: number | null;
    cost?: number | null;
    expiryDate?: Date | null;
    useRate?: number | null;
    useRatePeriod?: "day" | "week" | "month" | null;
  }) => void;
  /** Restock a matched existing item instead of creating a duplicate. */
  onRestock?: (itemId: string, qty: number) => void;
  /** Labelled standard blocks, used as categories / shelves */
  categories?: Category[];
  selectedBlockId?: string | null;
  selectedBlockLabel?: string;
  /** Store context for smart capture (name → type/unit/shelf + restock match). */
  items?: Item[];
  blocks?: BlocksMap;
  typeHints?: Record<string, ItemType>;
  crowdHints?: Record<string, ItemType>;
};

export function AddItemForm({
  onSubmit,
  onRestock,
  categories = [],
  selectedBlockId,
  selectedBlockLabel,
  items = [],
  blocks = {},
  typeHints = {},
  crowdHints = {},
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [nameError, setNameError] = useState(false);

  // Item type drives which fields are shown (via its traits). Auto-inferred from
  // the assigned zone/category until the user picks one explicitly.
  const [itemType, setItemType] = useState<ItemType>(DEFAULT_ITEM_TYPE);
  const [typeTouched, setTypeTouched] = useState(false);
  const [unitTouched, setUnitTouched] = useState(false);
  const [blockTouched, setBlockTouched] = useState(false);
  // Set when the typed name fuzzy-matches an item already in the store — powers
  // the "restock what you have instead of duplicating" nudge (Phase 2).
  const [matchedItemId, setMatchedItemId] = useState<string | null>(null);

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);

  // Rapid-entry loop: the panel stays open after each add, the name refocuses,
  // and a small ticker of what was just added builds up (Enter-add-Enter-add).
  const nameRef = useRef<HTMLInputElement>(null);
  const [addedTicker, setAddedTicker] = useState<string[]>([]);

  // Handle a scanned/typed barcode: parse GS1 fields locally, then look up
  // the product name/category for plain retail codes.
  const handleDetect = async (raw: string) => {
    setScanOpen(false);
    setLooking(true);
    setLookupNote(null);
    try {
      const info = await resolveBarcode(raw);
      if (info.sku) setSku(info.sku);
      // Tell apart a genuine miss from a transient failure so the user knows
      // whether to retry or just fill the name in by hand.
      if (info.lookupStatus === "rate_limited") {
        setLookupNote("Too many scans — try again in a minute.");
      } else if (info.lookupStatus === "error") {
        setLookupNote("Couldn't reach the product database — enter details.");
      } else if (info.lookupStatus === "not_found") {
        setLookupNote("Product not found — enter the details below.");
      }
      if (info.expiry) {
        setExpiryDate(toDateInput(info.expiry));
        setShowExtra(true);
      }
      if (info.unit) {
        // A scanned unit is authoritative — don't let name-inference override it.
        setUnit((u) => u || info.unit!);
        setUnitTouched(true);
      }
      if (info.name) setName((prev) => prev || info.name!);
      if (info.category === "Food") {
        // A food barcode is a strong type signal — unless the user already chose.
        if (!typeTouched) setItemType("food");
        // Fallback auto-shelf — only when no block was picked on the floor plan
        if (!selectedBlockId) {
          const foodCat = categories.find((c) =>
            FOOD_CATEGORY_RE.test(c.label),
          );
          if (foodCat) setFallbackCategoryId(foodCat.id);
        }
      }
    } finally {
      setLooking(false);
    }
  };

  // Floor-plan click wins; otherwise fall back to the chosen category shelf.
  const resolvedBlockId = selectedBlockId || fallbackCategoryId || "";

  // The existing item the typed name matched (if any) — offer a restock instead
  // of silently creating a duplicate.
  const matchedItem = matchedItemId
    ? (items.find((i) => i.id === matchedItemId) ?? null)
    : null;

  // Which category/zone applies — used to auto-infer the item type.
  const categoryLabel = selectedBlockId
    ? (selectedBlockLabel ??
      categories.find((c) => c.id === selectedBlockId)?.label ??
      "")
    : (categories.find((c) => c.id === fallbackCategoryId)?.label ?? "");

  // The type's traits decide which fields are relevant (no expiry on a wrench).
  const fields = fieldsForType(itemType);

  // Smart type: a concrete guess from the *name* (via the shared inference
  // engine) wins; otherwise fall back to the zone/category label. Only until the
  // user picks a type themselves.
  useEffect(() => {
    if (typeTouched) return;
    const n = name.trim();
    const nameType = n
      ? inferItemFields(n, items, blocks, typeHints, crowdHints).itemType
      : "other";
    const zoneType = inferTypeFromLabel(categoryLabel);
    if (nameType !== "other") setItemType(nameType);
    else if (zoneType) setItemType(zoneType);
  }, [name, categoryLabel, typeTouched, items, blocks, typeHints, crowdHints]);

  // Smart unit + shelf + restock match, driven by the name. Fills only fields
  // the user hasn't touched, and never overrides a floor-plan block selection.
  useEffect(() => {
    const n = name.trim();
    if (!n) {
      setMatchedItemId(null);
      return;
    }
    const inf = inferItemFields(n, items, blocks, typeHints, crowdHints);
    setMatchedItemId(inf.matchedItemId);
    if (!unitTouched && inf.unit) setUnit(inf.unit);
    if (!selectedBlockId && !blockTouched && inf.blockId)
      setFallbackCategoryId(inf.blockId);
  }, [
    name,
    items,
    blocks,
    typeHints,
    crowdHints,
    unitTouched,
    blockTouched,
    selectedBlockId,
  ]);

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
          (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        )
      : null;

  // Expiry quick-set: a few relative chips beat typing a date. The per-type
  // default (fridge food → +1w, meds → +1m) is highlighted, never auto-filled.
  const EXPIRY_CHIPS = [
    { days: 3, label: "+3d" },
    { days: 7, label: "+1w" },
    { days: 14, label: "+2w" },
    { days: 30, label: "+1m" },
  ];
  const suggestedExpiryDays =
    itemType === "food" ? 7 : itemType === "medication" ? 30 : null;
  const setExpiryInDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setExpiryDate(toDateInput(d));
    setShowDatePicker(false);
  };
  const activeExpiryChip = (() => {
    if (!expiryDate) return null;
    for (const c of EXPIRY_CHIPS) {
      const d = new Date();
      d.setDate(d.getDate() + c.days);
      if (toDateInput(d) === expiryDate) return c.days;
    }
    return null;
  })();

  const resetForm = () => {
    setName("");
    setDescription("");
    setQuantity(1);
    setQuantityTouched(false);
    setItemType(DEFAULT_ITEM_TYPE);
    setTypeTouched(false);
    setUnitTouched(false);
    setBlockTouched(false);
    setMatchedItemId(null);
    setFallbackCategoryId("");
    setSku("");
    setUnit("");
    setMinQuantity("");
    setCost("");
    setExpiryDate("");
    setUseRate("");
    setUseRatePeriod("week");
    setShowExtra(false);
    setShowDatePicker(false);
    setLookupNote(null);
  };

  // ── Reusable field blocks (so the relevant one can be promoted inline) ──

  const expiryField = (
    <div className="flex flex-col gap-2">
      <FieldLabel>Expiry</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {EXPIRY_CHIPS.map((c) => {
          const active = activeExpiryChip === c.days;
          const suggested = !expiryDate && suggestedExpiryDays === c.days;
          return (
            <button
              type="button"
              key={c.days}
              onClick={() => setExpiryInDays(c.days)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                active
                  ? "bg-slate-800 text-white border border-slate-800"
                  : suggested
                    ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border border-slate-200 bg-white text-slate-500 hover:border-slate-400"
              }`}
            >
              {c.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowDatePicker((v) => !v)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
            showDatePicker || (expiryDate && activeExpiryChip == null)
              ? "bg-slate-800 text-white border border-slate-800"
              : "border border-slate-200 bg-white text-slate-500 hover:border-slate-400"
          }`}
        >
          Date…
        </button>
        {expiryDate && (
          <button
            type="button"
            onClick={() => {
              setExpiryDate("");
              setShowDatePicker(false);
            }}
            className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>
      {showDatePicker && (
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className={inputClass}
        />
      )}
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
        // Accept an explicit multiplier in the name ("Milk x2") so a single
        // field captures name + quantity. Only the x/×/* form — never a bare
        // trailing number, which would mangle names like "WD 40" or "B12".
        const mult = name.trim().match(/^(.*?)[\s,]*[x×*]\s*(\d+)\s*$/i);
        const finalName = (mult ? mult[1] : name).trim();
        const finalQty =
          mult && !quantityTouched
            ? parseInt(mult[2], 10) || quantity
            : quantity;
        onSubmit({
          name: finalName,
          description,
          quantity: finalQty,
          selectedBlockId: resolvedBlockId || null,
          itemType,
          sku: sku || null,
          unit: unit || null,
          minQuantity: minQuantity !== "" ? Number(minQuantity) : null,
          cost: cost !== "" ? Math.round(Number(cost) * 100) : null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          useRate: useRate !== "" ? Number(useRate) : null,
          useRatePeriod: useRate !== "" ? useRatePeriod : null,
        });
        resetForm();
        // Rapid entry: keep the panel open, remember what was added, refocus.
        setAddedTicker((prev) => [finalName, ...prev].slice(0, 6));
        setTimeout(() => nameRef.current?.focus(), 0);
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
        {!looking && lookupNote && (
          <p className="text-[10px] font-mono text-amber-500 text-center">
            {lookupNote}
          </p>
        )}
      </div>

      {/* Name */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Item Name</FieldLabel>
        <input
          ref={nameRef}
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
        {/* Duplicate guard: this name matches something you already track — offer
            a one-tap restock instead of creating a second copy. */}
        {matchedItem && onRestock && (
          <div className="mt-1 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-1.5">
            <span className="flex-1 text-[10px] font-mono leading-snug text-amber-800">
              You already have{" "}
              <span className="font-bold">{matchedItem.name}</span> (
              {matchedItem.quantity}
              {matchedItem.unit ? ` ${matchedItem.unit}` : ""} left)
            </span>
            <button
              type="button"
              onClick={() => onRestock(matchedItem.id, quantity)}
              className="shrink-0 rounded border border-amber-300 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-700 hover:bg-amber-100"
            >
              Restock +{quantity}
            </button>
          </div>
        )}
      </div>

      {/* Type — drives which tracking fields are shown */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Type</FieldLabel>
        <select
          value={itemType}
          onChange={(e) => {
            setItemType(e.target.value as ItemType);
            setTypeTouched(true);
          }}
          className={`${inputClass} cursor-pointer`}
        >
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t].label}
            </option>
          ))}
        </select>
        <p className="text-[10px] font-mono text-slate-400">
          {TYPE_META[itemType].hint}
        </p>
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
              onChange={(e) => {
                setFallbackCategoryId(e.target.value);
                setBlockTouched(true);
              }}
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

      {/* Quantity + Unit (unit only for edible types) */}
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
        {fields.unit && (
          <div className="flex flex-col gap-2 w-28">
            <FieldLabel>Unit</FieldLabel>
            <input
              type="text"
              value={unit}
              placeholder="ml, g, pcs…"
              list="measure-units"
              onChange={(e) => {
                setUnit(e.target.value);
                setUnitTouched(true);
              }}
              className={inputClass}
            />
            {/* Known units enable recipe "cooked this" stock decrement; free
                text is still allowed. */}
            <datalist id="measure-units">
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value} />
              ))}
            </datalist>
          </div>
        )}
      </div>

      {/* Min stock — only for types that deplete (drives low-stock + suggested qty) */}
      {fields.minQuantity && (
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
      )}

      {/* Tracking fields relevant to the chosen type, promoted inline */}
      {fields.expiry && expiryField}
      {fields.useRate && useRateField}

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

          {/* Expiry / use-rate escape hatch — only when the type didn't promote
              them above, so they stay reachable for edge cases. */}
          {!fields.expiry && expiryField}
          {!fields.useRate && useRateField}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm transition-all duration-150 hover:bg-slate-800 hover:text-white hover:border-slate-800"
      >
        Add Item
      </button>

      {/* Rapid-entry ticker — what you've added this session, newest first */}
      {addedTicker.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">
            Added
          </span>
          {addedTicker.map((n, i) => (
            <span
              key={`${n}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-mono text-emerald-700"
            >
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6l3 3 5-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {n}
            </span>
          ))}
        </div>
      )}

      {scanOpen && (
        <BarcodeScanner
          onDetect={handleDetect}
          onClose={() => setScanOpen(false)}
        />
      )}
    </form>
  );
}
