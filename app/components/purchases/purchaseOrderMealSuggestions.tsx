import { useState } from "react";

type Props = {
  /** Pretty ingredient names upcoming meals need but the store is out of. */
  names: string[];
  /** Names already on the shopping list (lowercased) — shown as "added". */
  existingNames: Set<string>;
  onAdd: (names: string[]) => void;
};

/**
 * "For upcoming meals" — a sibling to the restocking suggestions. Surfaces the
 * ingredients that recipes scheduled on the calendar (today onward) call for but
 * the store lacks, so the planning → shopping loop reaches the list directly.
 * Plain names (these items may not exist yet), added as unlinked rows.
 */
export function PurchaseOrderMealSuggestions({
  names,
  existingNames,
  onAdd,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (names.length === 0) return null;

  const isAdded = (name: string) => existingNames.has(name.toLowerCase());
  const remaining = names.filter((n) => !isAdded(n));

  return (
    <div className="shrink-0 border-b border-indigo-100 bg-indigo-50/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-9">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-indigo-700"
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
          For upcoming meals
          <span className="px-1.5 py-0.5 rounded-full bg-indigo-200/70 text-indigo-800">
            {names.length}
          </span>
        </button>

        {remaining.length > 0 && (
          <button
            onClick={() => onAdd(remaining)}
            className="text-[9px] font-bold uppercase tracking-widest text-indigo-700 hover:text-indigo-900 transition-colors"
          >
            + Add all
          </button>
        )}
      </div>

      {/* List */}
      {!collapsed && (
        <div className="max-h-44 overflow-y-auto px-2 pb-2 flex flex-col gap-1">
          {names.map((name) => {
            const added = isAdded(name);
            return (
              <button
                key={name}
                onClick={() => !added && onAdd([name])}
                disabled={added}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                  added
                    ? "opacity-40 cursor-default"
                    : "hover:bg-white cursor-pointer"
                }`}
              >
                <span className="text-[11px] font-mono text-slate-700 truncate">
                  {name}
                </span>
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
                  <span className="text-indigo-600 text-sm leading-none font-bold">
                    +
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
