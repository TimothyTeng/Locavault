import { useState } from "react";
import type { Item, ItemStatus } from "~/types/storeTypes";
import { getItemStatus } from "~/utils/helpers/storeTable.helper";

type Props = {
  /** All inventory items in the store */
  items: Item[];
  /** itemIds + names already on the shopping list (for "added" state) */
  existingItemIds: Set<string>;
  existingNames: Set<string>;
  onAdd: (item: Item) => void;
  onAddAll: (items: Item[]) => void;
};

const STATUS_RANK: Record<ItemStatus, number> = {
  out: 0,
  expiring: 1,
  low: 2,
  ok: 3,
};

function pill(status: ItemStatus) {
  const map: Record<ItemStatus, { label: string; cls: string }> = {
    out: { label: "Out", cls: "bg-red-100 text-red-600" },
    expiring: { label: "Expiring", cls: "bg-amber-100 text-amber-600" },
    low: { label: "Low", cls: "bg-orange-100 text-orange-600" },
    ok: { label: "OK", cls: "bg-emerald-100 text-emerald-600" },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

/**
 * Inline "Needs restocking" section shown at the top of the shopping list.
 * Surfaces low / out / expiring items so the user sees what to buy on entry,
 * with one-tap Add (and Add all).
 */
export function PurchaseOrderSuggestions({
  items,
  existingItemIds,
  existingNames,
  onAdd,
  onAddAll,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const suggestions = items
    .map((item) => ({ item, status: getItemStatus(item) }))
    .filter(({ status }) => status !== "ok")
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  if (suggestions.length === 0) return null;

  const isAdded = (item: Item) =>
    existingItemIds.has(item.id) || existingNames.has(item.name);

  const remaining = suggestions.filter(({ item }) => !isAdded(item));

  return (
    <div className="shrink-0 border-b border-amber-100 bg-amber-50/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-9">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-amber-700"
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 12 12"
            fill="none"
            className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Needs restocking
          <span className="px-1.5 py-0.5 rounded-full bg-amber-200/70 text-amber-800">
            {suggestions.length}
          </span>
        </button>

        {remaining.length > 0 && (
          <button
            onClick={() => onAddAll(remaining.map((s) => s.item))}
            className="text-[9px] font-bold uppercase tracking-widest text-amber-700 hover:text-amber-900 transition-colors"
          >
            + Add all
          </button>
        )}
      </div>

      {/* List */}
      {!collapsed && (
        <div className="max-h-44 overflow-y-auto px-2 pb-2 flex flex-col gap-1">
          {suggestions.map(({ item, status }) => {
            const added = isAdded(item);
            return (
              <button
                key={item.id}
                onClick={() => !added && onAdd(item)}
                disabled={added}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                  added
                    ? "opacity-40 cursor-default"
                    : "hover:bg-white cursor-pointer"
                }`}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] font-mono text-slate-700 truncate">
                    {item.name}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    qty {item.quantity}
                    {item.unit ? ` ${item.unit}` : ""}
                    {item.minQuantity != null ? ` · min ${item.minQuantity}` : ""}
                  </span>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  {pill(status)}
                  {added ? (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="#94a3b8"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span className="text-amber-600 text-sm leading-none font-bold">
                      +
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
