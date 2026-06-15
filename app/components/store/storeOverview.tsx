import type { Item, ItemStatus } from "~/types/storeTypes";
import { getItemStatus } from "~/utils/helpers/storeTable.helper";

/**
 * The store "action queue" — a calm summary of what needs attention, shown above
 * the inventory when no zone is focused. Chips toggle a status filter on the list
 * below. Quiet by design: when everything is OK it just says so. (DESIGN.md §4/§6.)
 */
export function StoreOverview({
  items,
  restockCandidates,
  onAddAll,
  activeStatus,
  onSelectStatus,
  viewMode,
  onViewModeChange,
}: {
  items: Item[];
  /** Out/low items not already on the shopping list — the "add all" targets. */
  restockCandidates: Item[];
  onAddAll?: (items: Item[]) => void;
  /** Currently-applied status filter (chip highlights). */
  activeStatus?: ItemStatus | null;
  /** Toggle a status filter on the list below. */
  onSelectStatus?: (status: ItemStatus) => void;
  /** Cards/table view of the list below. */
  viewMode?: "cards" | "table";
  onViewModeChange?: (mode: "cards" | "table") => void;
}) {
  let out = 0;
  let low = 0;
  let expiring = 0;
  for (const i of items) {
    const s = getItemStatus(i);
    if (s === "out") out += 1;
    else if (s === "low") low += 1;
    else if (s === "expiring") expiring += 1;
  }
  const allOk = out + low + expiring === 0;

  return (
    <div className="px-3 py-2 border-b border-slate-100 bg-white shrink-0 flex items-center gap-2 flex-wrap">
      {allOk ? (
        <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Everything's stocked
        </div>
      ) : (
        <>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
            Needs attention
          </span>
          {out > 0 && (
            <Chip
              tone="critical"
              label="Out"
              count={out}
              active={activeStatus === "out"}
              onClick={onSelectStatus ? () => onSelectStatus("out") : undefined}
            />
          )}
          {low > 0 && (
            <Chip
              tone="attention"
              label="Low"
              count={low}
              active={activeStatus === "low"}
              onClick={onSelectStatus ? () => onSelectStatus("low") : undefined}
            />
          )}
          {expiring > 0 && (
            <Chip
              tone="attention"
              label="Expiring"
              count={expiring}
              active={activeStatus === "expiring"}
              onClick={
                onSelectStatus ? () => onSelectStatus("expiring") : undefined
              }
            />
          )}
        </>
      )}

      <div className="flex-1" />

      {onAddAll && restockCandidates.length > 0 && (
        <button
          onClick={() => onAddAll(restockCandidates)}
          className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700 hover:bg-amber-100 transition-colors"
        >
          Add {restockCandidates.length} to list
        </button>
      )}

      {viewMode && onViewModeChange && (
        <div className="flex items-center rounded-md border border-slate-200 overflow-hidden">
          <ViewBtn
            active={viewMode === "cards"}
            onClick={() => onViewModeChange("cards")}
            label="Cards"
          >
            <path d="M2 2h4v4H2zM8 2h4v4H8zM2 8h4v4H2zM8 8h4v4H8z" />
          </ViewBtn>
          <ViewBtn
            active={viewMode === "table"}
            onClick={() => onViewModeChange("table")}
            label="Table"
          >
            <path
              d="M2 3h10M2 7h10M2 11h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </ViewBtn>
        </div>
      )}
    </div>
  );
}

function ViewBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} view`}
      aria-label={`${label} view`}
      className={`flex items-center justify-center w-7 h-6 transition-colors ${
        active
          ? "bg-slate-800 text-white"
          : "bg-white text-slate-400 hover:text-slate-700"
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
        {children}
      </svg>
    </button>
  );
}

function Chip({
  tone,
  label,
  count,
  active,
  onClick,
}: {
  tone: "critical" | "attention";
  label: string;
  count: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const critical = tone === "critical";
  const dot = critical ? "#ef4444" : "#f59e0b";
  const border = critical ? "#fecaca" : "#fde68a";
  const text = critical ? "#dc2626" : "#d97706";
  return (
    <button
      type="button"
      onClick={onClick}
      title={onClick ? `Show only ${label.toLowerCase()} items` : undefined}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono tabular-nums transition-all ${
        onClick ? "cursor-pointer hover:brightness-95" : "cursor-default"
      } ${active ? "ring-1 ring-offset-1" : ""}`}
      style={{
        borderColor: border,
        color: text,
        background: active ? (critical ? "#fef2f2" : "#fffbeb") : undefined,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
      {count} {label}
    </button>
  );
}
