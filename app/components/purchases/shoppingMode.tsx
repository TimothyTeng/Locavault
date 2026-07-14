import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { PurchaseOrderItem } from "~/types/purchaseOrderTypes";
import { ITEM_TYPES, TYPE_META } from "~/lib/itemTypes";
import { basketTotal, formatMoney } from "~/utils/helpers/money.helper";
import { useBlockOptions } from "~/components/store/blockOptions";
import { CloseButton } from "~/components/common/CloseButton";

type Props = {
  isOpen: boolean;
  items: PurchaseOrderItem[];
  checkedIds: Set<string>;
  onToggleChecked: (id: string) => void;
  onUpdate: (item: PurchaseOrderItem) => void;
  /** Commit every ticked + located row to inventory (parent's bulk buy). */
  onFinish: () => void;
  onClose: () => void;
  /** Jump to a zone on the map (unpack sheet "show on map"). */
  onShowOnMap?: (blockId: string) => void;
};

/**
 * Full-screen "shopping mode" — the thing you hold in the supermarket. Rows are
 * grouped by item type (an aisle proxy) with big one-tap check targets and qty
 * steppers; ticking a row sinks it to "In cart". A running basket total footers
 * the screen, and one "Finish" commits everything located to inventory (DESIGN
 * §5 · Part B "weekly shop"). After finishing it flips to an unpack sheet that
 * groups the haul by destination zone.
 */
export function ShoppingMode({
  isOpen,
  items,
  checkedIds,
  onToggleChecked,
  onUpdate,
  onFinish,
  onClose,
  onShowOnMap,
}: Props) {
  const { options: blockOptions, labelOf } = useBlockOptions();
  const [phase, setPhase] = useState<"shop" | "unpack">("shop");
  // Snapshot of what was bought, captured at finish for the unpack sheet.
  const [bought, setBought] = useState<PurchaseOrderItem[]>([]);

  const checkedRows = items.filter((i) => checkedIds.has(i.id));
  const uncheckedRows = items.filter((i) => !checkedIds.has(i.id));
  const unlocatedChecked = checkedRows.filter((r) => !r.blockId);
  const committable = checkedRows.filter((r) => r.blockId);
  const basket = basketTotal(committable);

  // Unchecked rows grouped by type, in the canonical type order (aisle proxy).
  const groups = useMemo(() => {
    const byType = new Map<string, PurchaseOrderItem[]>();
    for (const r of uncheckedRows) {
      const arr = byType.get(r.itemType);
      if (arr) arr.push(r);
      else byType.set(r.itemType, [r]);
    }
    return ITEM_TYPES.map((t) => ({
      type: t,
      rows: byType.get(t) ?? [],
    })).filter((g) => g.rows.length > 0);
  }, [uncheckedRows]);

  if (!isOpen) return null;

  const setQty = (row: PurchaseOrderItem, next: number) =>
    onUpdate({ ...row, quantity: Math.max(1, next) });

  const handleFinish = () => {
    if (!committable.length) return;
    setBought(committable);
    onFinish();
    setPhase("unpack");
  };

  // ── Unpack sheet: the haul grouped by destination zone ──
  const unpackGroups = (() => {
    const byBlock = new Map<string | null, PurchaseOrderItem[]>();
    for (const r of bought) {
      const key = r.blockId ?? null;
      const arr = byBlock.get(key);
      if (arr) arr.push(r);
      else byBlock.set(key, [r]);
    }
    return [...byBlock.entries()].map(([blockId, rows]) => ({
      blockId,
      label: labelOf(blockId) ?? "Unassigned",
      rows,
    }));
  })();

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-white flex flex-col font-mono">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 md:px-8 h-14 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold uppercase tracking-widest text-slate-800">
            {phase === "shop" ? "Shopping" : "Put away"}
          </span>
          {phase === "shop" && (
            <span className="text-[11px] text-slate-400">
              {uncheckedRows.length} to get · {checkedRows.length} in cart
            </span>
          )}
        </div>
        <CloseButton
          onClick={onClose}
          size={16}
          strokeWidth={1.8}
          className="text-slate-400 hover:text-slate-700 transition-colors"
        />
      </div>

      {phase === "shop" ? (
        <>
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 max-w-2xl w-full mx-auto">
            {items.length === 0 ? (
              <p className="text-center text-[12px] text-slate-400 py-16">
                Your list is empty.
              </p>
            ) : (
              <>
                {groups.map((g) => (
                  <section key={g.type} className="mb-5">
                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                      {TYPE_META[g.type].label}
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {g.rows.map((row) => (
                        <ShopRow
                          key={row.id}
                          row={row}
                          checked={false}
                          labelOf={labelOf}
                          onToggle={() => onToggleChecked(row.id)}
                          onQty={(n) => setQty(row, n)}
                        />
                      ))}
                    </ul>
                  </section>
                ))}

                {checkedRows.length > 0 && (
                  <section className="mt-6 border-t border-slate-100 pt-4">
                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 mb-2">
                      In cart ({checkedRows.length})
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {checkedRows.map((row) => (
                        <ShopRow
                          key={row.id}
                          row={row}
                          checked
                          labelOf={labelOf}
                          blockOptions={blockOptions}
                          onToggle={() => onToggleChecked(row.id)}
                          onQty={(n) => setQty(row, n)}
                          onSetBlock={(blockId) =>
                            onUpdate({ ...row, blockId })
                          }
                        />
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>

          {/* Footer: basket total + finish */}
          <div className="shrink-0 border-t border-slate-200 px-4 md:px-8 py-3">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
              <div className="flex flex-col">
                {basket.priced > 0 && (
                  <span className="text-[13px] font-bold text-slate-800 tabular-nums">
                    ~{formatMoney(basket.cents)}
                    {basket.unpriced > 0 && (
                      <span className="ml-1 text-[10px] font-normal text-slate-400">
                        +{basket.unpriced} unpriced
                      </span>
                    )}
                  </span>
                )}
                {unlocatedChecked.length > 0 && (
                  <span className="text-[10px] text-amber-600">
                    {unlocatedChecked.length} in cart need a location
                  </span>
                )}
              </div>
              <button
                onClick={handleFinish}
                disabled={committable.length === 0}
                className="rounded-md bg-emerald-600 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Finish · add {committable.length} to inventory
              </button>
            </div>
          </div>
        </>
      ) : (
        // ── Unpack sheet ──
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-2xl w-full mx-auto">
          <p className="text-[12px] text-slate-500 mb-5">
            Nice — {bought.length} item{bought.length !== 1 ? "s" : ""} added.
            Here's where everything goes:
          </p>
          {unpackGroups.map((g) => (
            <section key={g.blockId ?? "none"} className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  {g.label}
                </h3>
                {g.blockId && onShowOnMap && (
                  <button
                    onClick={() => onShowOnMap(g.blockId!)}
                    className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-800 transition-colors"
                  >
                    Show on map
                  </button>
                )}
              </div>
              <ul className="flex flex-col gap-0.5 pl-1">
                {g.rows.map((r) => (
                  <li
                    key={r.id}
                    className="text-[12px] text-slate-700 flex items-baseline gap-2"
                  >
                    <span className="text-slate-300">·</span>
                    {r.name}
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      ×{r.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <button
            onClick={onClose}
            className="mt-4 w-full rounded-md bg-slate-800 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}

function ShopRow({
  row,
  checked,
  labelOf,
  blockOptions,
  onToggle,
  onQty,
  onSetBlock,
}: {
  row: PurchaseOrderItem;
  checked: boolean;
  labelOf: (id: string | null) => string | null;
  blockOptions?: { id: string; label: string }[];
  onToggle: () => void;
  onQty: (n: number) => void;
  onSetBlock?: (blockId: string) => void;
}) {
  const zone = labelOf(row.blockId);
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        checked
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <button
        onClick={onToggle}
        aria-pressed={checked}
        aria-label={checked ? `Uncheck ${row.name}` : `Check off ${row.name}`}
        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          checked
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-300 hover:border-slate-500"
        }`}
      >
        {checked && (
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={`text-[13px] font-semibold truncate ${
            checked ? "text-slate-400 line-through" : "text-slate-800"
          }`}
        >
          {row.name}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          {zone ? <span>📍 {zone}</span> : null}
          {row.cost != null && (
            <span className="tabular-nums">{formatMoney(row.cost)}</span>
          )}
        </div>
        {/* Unlocated in-cart rows must pick a home before finishing. */}
        {checked && !row.blockId && onSetBlock && blockOptions && (
          <select
            value=""
            onChange={(e) => e.target.value && onSetBlock(e.target.value)}
            className="mt-1 text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-1 focus:outline-none"
          >
            <option value="">Set a location…</option>
            {blockOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Qty stepper */}
      <div className="shrink-0 flex items-center gap-1.5">
        <button
          onClick={() => onQty(row.quantity - 1)}
          disabled={row.quantity <= 1}
          aria-label="Decrease quantity"
          className="w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center justify-center text-[14px] leading-none"
        >
          −
        </button>
        <span className="w-6 text-center text-[13px] font-bold tabular-nums text-slate-700">
          {row.quantity}
        </span>
        <button
          onClick={() => onQty(row.quantity + 1)}
          aria-label="Increase quantity"
          className="w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex items-center justify-center text-[14px] leading-none"
        >
          +
        </button>
      </div>
    </li>
  );
}
