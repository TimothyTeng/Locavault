import { useEffect, useRef } from "react";
import type { ItemStatus } from "~/types/storeTypes";
import {
  SORT_LABELS,
  type FilterState,
  type SortDir,
  type SortKey,
} from "~/utils/helpers/storeTable.helper";

export function FilterSortPanel({
  sortKey,
  sortDir,
  filters,
  onSortKeyChange,
  onSortDirChange,
  onFilterChange,
  onClear,
  onClose,
}: {
  sortKey: SortKey | null;
  sortDir: SortDir;
  filters: FilterState;
  onSortKeyChange: (k: SortKey | null) => void;
  onSortDirChange: (d: SortDir) => void;
  onFilterChange: (f: FilterState) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const toggleStatus = (s: ItemStatus) => {
    const next = new Set(filters.statuses);
    next.has(s) ? next.delete(s) : next.add(s);
    onFilterChange({ ...filters, statuses: next });
  };

  const STATUS_LABELS: Record<ItemStatus, string> = {
    ok: "OK",
    low: "Low stock",
    expiring: "Expiring",
    out: "Out of stock",
  };
  const STATUS_COLORS: Record<ItemStatus, string> = {
    ok: "text-emerald-600",
    low: "text-red-500",
    expiring: "text-amber-600",
    out: "text-slate-400",
  };

  const sectionLabel =
    "text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2";
  const rowClass = "flex items-center justify-between py-1.5";
  const checkClass =
    "w-3.5 h-3.5 rounded border border-slate-300 accent-slate-700 cursor-pointer";

  return (
    <div
      ref={panelRef}
      className="absolute top-full right-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl w-64 p-4 flex flex-col gap-4 overflow-y-auto max-h-[60vh]"
    >
      {/* Sort by */}
      <div>
        <p className={sectionLabel}>Sort by</p>
        <div className="flex flex-col gap-0.5">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => {
            const activeKey = sortKey === k;
            return (
              // Row is a container of two sibling buttons (select + direction) —
              // never a button nested inside a button (invalid markup).
              <div
                key={k}
                className={[
                  "flex items-center rounded-md text-[11px] font-mono transition-colors w-full",
                  activeKey
                    ? "bg-slate-800 text-white"
                    : "text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                <button
                  onClick={() => onSortKeyChange(activeKey ? null : k)}
                  aria-pressed={activeKey}
                  className="flex-1 text-left px-2 py-1.5"
                >
                  {SORT_LABELS[k]}
                </button>
                {activeKey && (
                  <button
                    onClick={() =>
                      onSortDirChange(sortDir === "asc" ? "desc" : "asc")
                    }
                    aria-label={`Sort direction: ${
                      sortDir === "asc" ? "ascending" : "descending"
                    }`}
                    className="px-2 py-1.5 text-[10px] opacity-70 hover:opacity-100"
                  >
                    {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full h-px bg-slate-100" />

      {/* Filter by status */}
      <div>
        <p className={sectionLabel}>Filter by status</p>
        {(["ok", "low", "expiring", "out"] as ItemStatus[]).map((s) => (
          <label key={s} className={`${rowClass} cursor-pointer`}>
            <span className={`text-[11px] font-mono ${STATUS_COLORS[s]}`}>
              {STATUS_LABELS[s]}
            </span>
            <input
              type="checkbox"
              className={checkClass}
              checked={filters.statuses.has(s)}
              onChange={() => toggleStatus(s)}
            />
          </label>
        ))}
      </div>

      <div className="w-full h-px bg-slate-100" />

      {/* Additional filters */}
      <div>
        <p className={sectionLabel}>Additional filters</p>
        <label className={`${rowClass} cursor-pointer`}>
          <span className="text-[11px] font-mono text-slate-600">
            Has expiry date
          </span>
          <input
            type="checkbox"
            className={checkClass}
            checked={filters.hasExpiry}
            onChange={() =>
              onFilterChange({ ...filters, hasExpiry: !filters.hasExpiry })
            }
          />
        </label>
        <label className={`${rowClass} cursor-pointer`}>
          <span className="text-[11px] font-mono text-slate-600">
            Has use rate
          </span>
          <input
            type="checkbox"
            className={checkClass}
            checked={filters.hasUseRate}
            onChange={() =>
              onFilterChange({ ...filters, hasUseRate: !filters.hasUseRate })
            }
          />
        </label>
      </div>

      {/* Clear */}
      <button
        onClick={onClear}
        className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
      >
        Clear all
      </button>
    </div>
  );
}
