import { useState, useRef, useEffect, useMemo } from "react";
import type { Item, ItemStatus } from "#types/storeTypes";
import type { AccessLevel } from "~/types/memberTypes";
import { StoreTableRow } from "./storeTableRow";
import { getItemStatus } from "~/utils/helpers/storeTableHelper.helper";
import {
  expiryDateRemainingDays,
  remainingDays,
} from "~/utils/helpers/store.helper";

type Props = {
  items: Item[];
  selectedItemId: string | null;
  onSelect: (item: Item) => void;
  onSave: (updated: Item) => void;
  onDelete: (itemId: string) => void;
  accessLevel: AccessLevel;
  storeIsPublic: boolean;
  onToggleItemVisibility: (itemId: string, isPublic: boolean) => void;
};

type SortKey = "name" | "quantity" | "expiry" | "depletion" | "status";
type SortDir = "asc" | "desc";

type FilterState = {
  statuses: Set<ItemStatus>;
  hasExpiry: boolean;
  hasUseRate: boolean;
};

const STATUS_ORDER: ItemStatus[] = ["out", "low", "expiring", "ok"];

function getSortValue(item: Item, key: SortKey): number | string {
  switch (key) {
    case "name":
      return item.name.toLowerCase();
    case "quantity":
      return item.quantity;
    case "expiry": {
      const d = expiryDateRemainingDays(item.expiryDate);
      return d ?? Infinity;
    }
    case "depletion": {
      const d =
        item.useRate && item.useRatePeriod
          ? Number(
              remainingDays(
                item.createdAt,
                item.useRate.toString(),
                item.useRatePeriod,
                item.quantity,
              ),
            )
          : null;
      return d ?? Infinity;
    }
    case "status":
      return STATUS_ORDER.indexOf(getItemStatus(item));
  }
}

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  quantity: "Qty",
  expiry: "Expiry",
  depletion: "Est Depletion",
  status: "Status",
};

// ── Filter & Sort Panel ────────────────────────────────────

function FilterSortPanel({
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
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
      className="absolute top-full right-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl w-64 p-4 flex flex-col gap-4"
    >
      {/* Sort by */}
      <div>
        <p className={sectionLabel}>Sort by</p>
        <div className="flex flex-col gap-0.5">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => onSortKeyChange(sortKey === k ? null : k)}
              className={[
                "flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-mono transition-colors w-full",
                sortKey === k
                  ? "bg-slate-800 text-white"
                  : "text-slate-600 hover:bg-slate-50",
              ].join(" ")}
            >
              <span>{SORT_LABELS[k]}</span>
              {sortKey === k && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSortDirChange(sortDir === "asc" ? "desc" : "asc");
                  }}
                  className="text-[10px] opacity-70 hover:opacity-100 ml-2"
                >
                  {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
                </button>
              )}
            </button>
          ))}
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

// ── Sort arrow indicator ───────────────────────────────────

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span
      className={`ml-1 text-[9px] transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover/th:opacity-30"}`}
    >
      {!active || dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────

export function StoreTable({
  items,
  selectedItemId,
  onSelect,
  onSave,
  onDelete,
  accessLevel,
  storeIsPublic,
  onToggleItemVisibility,
}: Props) {
  const isOwner = accessLevel === "owner";

  // ── Search / sort / filter state ──
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<FilterState>({
    statuses: new Set(),
    hasExpiry: false,
    hasUseRate: false,
  });
  const [panelOpen, setPanelOpen] = useState(false);

  const activeCount =
    (sortKey ? 1 : 0) +
    filters.statuses.size +
    (filters.hasExpiry ? 1 : 0) +
    (filters.hasUseRate ? 1 : 0);

  const clearAll = () => {
    setSortKey(null);
    setSortDir("asc");
    setFilters({ statuses: new Set(), hasExpiry: false, hasUseRate: false });
  };

  // ── Derived: filter then sort ──
  const displayItems = useMemo(() => {
    let result = items;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }

    if (filters.statuses.size > 0) {
      result = result.filter((i) => filters.statuses.has(getItemStatus(i)));
    }

    if (filters.hasExpiry) result = result.filter((i) => i.expiryDate != null);
    if (filters.hasUseRate)
      result = result.filter(
        (i) => i.useRate != null && i.useRatePeriod != null,
      );

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = getSortValue(a, sortKey);
        const bv = getSortValue(b, sortKey);
        const cmp =
          typeof av === "string" && typeof bv === "string"
            ? av.localeCompare(bv)
            : (av as number) - (bv as number);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [items, search, filters, sortKey, sortDir]);

  // ── Column header click to sort ──
  const handleHeaderClick = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else {
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // ── Header definitions ──
  type HeaderDef =
    | { label: string; className: string; sortable: false }
    | { label: string; className: string; sortable: true; key: SortKey };

  const baseHeaders: HeaderDef[] = [
    { label: "#", className: "w-8 text-right", sortable: false },
    { label: "Name", className: "", sortable: true, key: "name" },
    {
      label: "Qty",
      className: "w-20 text-right",
      sortable: true,
      key: "quantity",
    },
    {
      label: "Expiry",
      className: "w-24 text-right",
      sortable: true,
      key: "expiry",
    },
    {
      label: "Est Depletion",
      className: "w-24 text-right",
      sortable: true,
      key: "depletion",
    },
    { label: "Status", className: "w-24", sortable: true, key: "status" },
  ];
  if (isOwner && storeIsPublic)
    baseHeaders.push({ label: "Public", className: "w-14", sortable: false });
  baseHeaders.push({ label: "", className: "w-14", sortable: false });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search + Filter/Sort bar */}
      <div className="px-3 h-11 flex items-center gap-2 border-b border-slate-100 bg-white shrink-0">
        {/* Search */}
        <div className="relative flex items-center flex-1 max-w-xs">
          <svg
            className="absolute left-2 text-slate-300 pointer-events-none"
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
          >
            <circle
              cx="5.5"
              cy="5.5"
              r="3.5"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M8 8l2.5 2.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="pl-6 pr-6 py-1 w-full rounded-md border border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-700 placeholder-slate-300 outline-none focus:border-slate-400 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 text-slate-300 hover:text-slate-500"
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path
                  d="M1 1l8 8M9 1L1 9"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Item count */}
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300 shrink-0">
          {displayItems.length} item{displayItems.length !== 1 ? "s" : ""}
        </span>

        {/* Filter & Sort button */}
        <div className="relative shrink-0">
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className={[
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-widest transition-all",
              panelOpen || activeCount > 0
                ? "bg-slate-800 border-slate-800 text-white"
                : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700",
            ].join(" ")}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M1 3h10M3 6h6M5 9h2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            Filter & Sort
            {activeCount > 0 && (
              <span className="bg-white text-slate-800 rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black leading-none">
                {activeCount}
              </span>
            )}
          </button>

          {panelOpen && (
            <FilterSortPanel
              sortKey={sortKey}
              sortDir={sortDir}
              filters={filters}
              onSortKeyChange={setSortKey}
              onSortDirChange={setSortDir}
              onFilterChange={setFilters}
              onClear={clearAll}
              onClose={() => setPanelOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr className="border-b border-slate-200">
              {baseHeaders.map((h, i) =>
                h.sortable ? (
                  <th
                    key={i}
                    onClick={() => handleHeaderClick(h.key)}
                    className={`group/th px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest cursor-pointer select-none transition-colors ${sortKey === h.key ? "text-slate-700" : "text-slate-400 hover:text-slate-600"} ${h.className}`}
                  >
                    {h.label}
                    <SortArrow active={sortKey === h.key} dir={sortDir} />
                  </th>
                ) : (
                  <th
                    key={i}
                    className={`px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 ${h.className}`}
                  >
                    {h.label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {displayItems.length === 0 ? (
              <tr>
                <td
                  colSpan={baseHeaders.length}
                  className="px-4 py-10 text-center text-[11px] text-slate-300 font-mono"
                >
                  No items found
                </td>
              </tr>
            ) : (
              displayItems.map((item, i) => (
                <StoreTableRow
                  key={item.id}
                  item={item}
                  index={i}
                  isSelected={selectedItemId === item.id}
                  onSelect={onSelect}
                  onSave={onSave}
                  onDelete={onDelete}
                  isOwner={isOwner}
                  storeIsPublic={storeIsPublic}
                  onToggleVisibility={onToggleItemVisibility}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
