import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Item, ItemStatus } from "~/types/storeTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
import { getItemStatus } from "~/utils/helpers/storeTable.helper";
import { TypeIcon } from "./typeIcon";

const DOT: Record<ItemStatus, string> = {
  out: "#94a3b8",
  low: "#ef4444",
  expiring: "#f59e0b",
  ok: "#34d399",
};

/**
 * Store-wide item search. Always available; selecting a result jumps to that
 * item's zone and highlights it on the canvas. (DESIGN.md §4 — the "I don't know
 * where it is" escape hatch that keeps canvas-primary from trapping you.)
 */
export function GlobalSearch({
  items,
  blocks,
  onJump,
}: {
  items: Item[];
  blocks: BlocksMap;
  onJump: (item: Item) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const q = query.trim().toLowerCase();
  const results = q
    ? items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8)
    : [];

  const choose = (item: Item) => {
    onJump(item);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <div className="relative flex items-center">
        <Search
          size={13}
          className="absolute left-2.5 text-slate-300 pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setOpen(false);
            } else if (e.key === "Enter" && results[0]) {
              choose(results[0]);
            }
          }}
          placeholder="Search all items…"
          className="pl-7 pr-3 py-1.5 w-full rounded-md border border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-700 placeholder-slate-300 outline-none focus:border-slate-400 focus:bg-white transition-colors"
        />
      </div>

      {open && q && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-72 overflow-auto rounded-md border border-slate-200 bg-white shadow-xl py-1">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-[11px] font-mono text-slate-300 text-center">
              No items match "{query}"
            </div>
          ) : (
            results.map((item) => {
              const zone = item.blockId
                ? (blocks[item.blockId]?.label ?? "Unlabelled zone")
                : "Unassigned";
              return (
                <button
                  key={item.id}
                  onClick={() => choose(item)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <TypeIcon
                    type={item.itemType}
                    className="w-3.5 h-3.5 text-slate-400 shrink-0"
                  />
                  <span className="text-[11px] font-semibold text-slate-800 truncate flex-1">
                    {item.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 truncate max-w-[40%]">
                    {zone}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                    {item.quantity}
                    {item.unit ? ` ${item.unit}` : ""}
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: DOT[getItemStatus(item)] }}
                  />
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
