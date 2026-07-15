import { useEffect, useMemo, useRef, useState } from "react";
import { X, ScanLine, Loader2 } from "lucide-react";
import { useDialog } from "~/components/common/useDialog";
import { parseQuickAdd } from "~/utils/helpers/quickAdd.helper";
import {
  parseReceipt,
  receiptTotalCents,
} from "~/utils/helpers/receipt.helper";
import { resolveBarcode } from "~/utils/helpers/barcode.helper";
import { inferTypeFromLabel } from "~/lib/itemTypes";
import { formatMoney } from "~/utils/helpers/money.helper";
import type { ItemType } from "~/types/itemTypeTypes";
import { TypeIcon } from "~/components/store/typeIcon";
import { BarcodeScanner, type BatchCode } from "./BarcodeScanner";

export type QuickAddItem = {
  name: string;
  quantity: number;
  itemType: ItemType;
  costCents?: number | null;
};

type Mode = "list" | "receipt";

// Seed tiles when a store has little history yet — food-first staples.
const STAPLE_TILES = [
  "Milk",
  "Eggs",
  "Bread",
  "Butter",
  "Rice",
  "Pasta",
  "Onions",
  "Bananas",
  "Chicken",
  "Coffee",
];

const typeOf = (name: string): ItemType => inferTypeFromLabel(name) ?? "other";

/**
 * Fast capture. Two modes:
 *   • **List** — tap frequent tiles and/or type a list ("Milk x2" style); each
 *     line's type is inferred and an optional zone shelves them together.
 *   • **Receipt** — paste a store receipt; `receipt.helper` extracts name +
 *     quantity + per-unit cost, so a shop turns into inventory (with prices) in
 *     one paste. (DESIGN.md §7 capture; Phase 9 purchase-capture spine.)
 */
export function QuickAddPanel({
  isOpen,
  onClose,
  onSubmit,
  categories,
  defaultBlockId = null,
  suggestions = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (items: QuickAddItem[], blockId: string | null) => void;
  categories: { id: string; label: string }[];
  defaultBlockId?: string | null;
  suggestions?: string[];
}) {
  const [mode, setMode] = useState<Mode>("list");
  const [text, setText] = useState("");
  const [tileCounts, setTileCounts] = useState<Record<string, number>>({});
  const [scanned, setScanned] = useState<QuickAddItem[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [blockId, setBlockId] = useState<string | null>(defaultBlockId);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useDialog(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setBlockId(defaultBlockId);
      setTileCounts({});
      setScanned([]);
      setText("");
      setMode("list");
      setTimeout(() => taRef.current?.focus(), 30);
    }
  }, [isOpen, defaultBlockId]);

  // Resolve a batch of scanned barcodes into named rows (Open Food Facts lookup),
  // merged into the review list by name so a re-scan bumps quantity.
  const handleBatch = async (codes: BatchCode[]) => {
    setScanOpen(false);
    if (!codes.length) return;
    setResolving(true);
    try {
      const rows = await Promise.all(
        codes.map(async (bc): Promise<QuickAddItem> => {
          try {
            const info = await resolveBarcode(bc.code);
            const name = info.name || `Item ${bc.code.slice(-5)}`;
            return {
              name,
              quantity: bc.qty,
              itemType: info.category === "Food" ? "food" : typeOf(name),
              costCents: null,
            };
          } catch {
            return {
              name: `Item ${bc.code.slice(-5)}`,
              quantity: bc.qty,
              itemType: "other",
              costCents: null,
            };
          }
        }),
      );
      setScanned((prev) => {
        const merged = new Map(
          prev.map((r) => [r.name.toLowerCase(), { ...r }]),
        );
        for (const r of rows) {
          const key = r.name.toLowerCase();
          const ex = merged.get(key);
          if (ex) ex.quantity += r.quantity;
          else merged.set(key, r);
        }
        return [...merged.values()];
      });
    } finally {
      setResolving(false);
    }
  };

  // Tiles: the store's own frequent names first, then staples it doesn't have.
  const tiles = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of [...suggestions, ...STAPLE_TILES]) {
      const key = n.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(n.trim());
      if (out.length >= 12) break;
    }
    return out;
  }, [suggestions]);

  const entries = useMemo<QuickAddItem[]>(() => {
    if (mode === "receipt") {
      return parseReceipt(text).map((r) => ({
        name: r.name,
        quantity: r.quantity,
        itemType: typeOf(r.name),
        costCents: r.costCents,
      }));
    }
    // List mode: merge tapped tiles with typed lines, summing by name.
    const merged = new Map<string, QuickAddItem>();
    const add = (name: string, qty: number) => {
      const key = name.trim().toLowerCase();
      if (!key) return;
      const existing = merged.get(key);
      if (existing) existing.quantity += qty;
      else
        merged.set(key, {
          name: name.trim(),
          quantity: qty,
          itemType: typeOf(name),
        });
    };
    for (const [name, qty] of Object.entries(tileCounts))
      if (qty > 0) add(name, qty);
    for (const e of parseQuickAdd(text)) add(e.name, e.quantity);
    // Scanned rows carry their own resolved type — fold them in last.
    for (const s of scanned) {
      const key = s.name.trim().toLowerCase();
      const existing = merged.get(key);
      if (existing) existing.quantity += s.quantity;
      else merged.set(key, { ...s });
    }
    return [...merged.values()];
  }, [mode, text, tileCounts, scanned]);

  const receiptTotal = useMemo(
    () => (mode === "receipt" ? receiptTotalCents(parseReceipt(text)) : 0),
    [mode, text],
  );

  if (!isOpen) return null;

  const bumpTile = (name: string, delta: number) =>
    setTileCounts((prev) => {
      const next = Math.max(0, (prev[name] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[name];
      else copy[name] = next;
      return copy;
    });

  const submit = () => {
    if (!entries.length) return;
    onSubmit(entries, blockId);
    setText("");
    setTileCounts({});
    setScanned([]);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick add items"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Quick add
            </span>
            <p className="text-[13px] font-bold text-slate-800">
              {mode === "receipt"
                ? "Paste a receipt"
                : "Tap tiles or type a list"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-300 transition-colors hover:text-slate-600"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Mode toggle */}
        <div
          role="tablist"
          aria-label="Capture mode"
          className="mx-5 mt-4 flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold uppercase tracking-widest"
        >
          {(["list", "receipt"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                mode === m
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {m === "list" ? "List" : "Receipt"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
          {/* Scan-to-add (list mode) */}
          {mode === "list" && (
            <button
              onClick={() => setScanOpen(true)}
              disabled={resolving}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 disabled:opacity-50"
            >
              {resolving ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Looking up…
                </>
              ) : (
                <>
                  <ScanLine size={13} /> Scan items
                </>
              )}
            </button>
          )}

          {/* Tile grid (list mode) */}
          {mode === "list" && tiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tiles.map((name) => {
                const count = tileCounts[name.trim().toLowerCase()] ?? 0;
                const active = count > 0;
                return (
                  <button
                    key={name}
                    onClick={() => bumpTile(name, 1)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      bumpTile(name, -1);
                    }}
                    title={active ? "Tap +1 · right-click −1" : "Tap to add"}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    <TypeIcon
                      type={typeOf(name)}
                      className="h-3 w-3 shrink-0 opacity-60"
                    />
                    {name}
                    {active && (
                      <span className="ml-0.5 rounded-full bg-emerald-600 px-1 text-[9px] font-bold tabular-nums text-white">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={mode === "receipt" ? 7 : 5}
            placeholder={
              mode === "receipt"
                ? "MILK 2L      3.49\nEGGS 12CT    3.99\nBREAD        2.00\n…paste the whole receipt"
                : "Milk x2\nEggs 12\nOlive oil\nPasta, 3"
            }
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[13px] text-slate-800 placeholder-slate-300 outline-none focus:border-slate-400 focus:bg-white"
          />

          <label className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
            Shelve in
            <select
              value={blockId ?? ""}
              onChange={(e) => setBlockId(e.target.value || null)}
              className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="">No zone (unassigned)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {entries.length > 0 && (
            <div className="max-h-44 overflow-auto rounded-lg border border-slate-100 bg-slate-50/60 p-1">
              {entries.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded px-2 py-1 text-[12px]"
                >
                  <TypeIcon
                    type={e.itemType}
                    className="h-3.5 w-3.5 shrink-0 text-slate-400"
                  />
                  <span className="flex-1 truncate text-slate-700">
                    {e.name}
                  </span>
                  {e.costCents != null && (
                    <span className="font-mono text-[11px] tabular-nums text-emerald-600">
                      {formatMoney(e.costCents)}
                    </span>
                  )}
                  <span className="font-mono text-[11px] tabular-nums text-slate-400">
                    ×{e.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}

          {mode === "receipt" && receiptTotal > 0 && (
            <p className="text-right text-[11px] text-slate-400">
              Receipt total ~
              <span className="font-semibold text-slate-600">
                {formatMoney(receiptTotal)}
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
          <span className="text-[10px] font-mono text-slate-300">
            ⌘/Ctrl+Enter
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!entries.length}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add {entries.length || ""} item{entries.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>

      {scanOpen && (
        <BarcodeScanner
          onClose={() => setScanOpen(false)}
          onBatch={handleBatch}
          onDetect={(raw) => handleBatch([{ code: raw, qty: 1 }])}
        />
      )}
    </>
  );
}
